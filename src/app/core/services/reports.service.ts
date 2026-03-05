import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  docData,
  getDocs,
  orderBy,
  query,
  runTransaction,
  where,
} from '@angular/fire/firestore';
import {
  Observable,
  combineLatest,
  firstValueFrom,
  map,
  of,
  shareReplay,
  switchMap,
  take,
  timer,
  catchError,
} from 'rxjs';
import {
  Timestamp,
  updateDoc,
  serverTimestamp,
  type DocumentReference,
  type WithFieldValue,
  type UpdateData,
} from 'firebase/firestore';
import { AuthService } from '../guards/auth.service';
import { PairContextService } from './pair-context.service';
import { SummaryService } from './summary.service';
import { Note } from '../models/note.type';
import { ReportDoc, ReportSourceNote } from '../models/report-doc.type';
import { Schedule } from '../models/schedule.type';

// const REPORT_PERIOD_OVERRIDE_CURRENT: { startISO: string; endISO: string } | null = {
//   startISO: '2026-03-02T14:45:00+03:00',
//   endISO: '2026-03-02T14:48:00+03:00',
// };
// const REPORT_PERIOD_OVERRIDE_PREVIOUS: { startISO: string; endISO: string } | null = {
//   startISO: '2026-02-11T18:00:00+03:00',
//   endISO: '2026-03-02T14:45:00+03:00',
// };

type PeriodOverride = { startISO: string; endISO: string } | null;
const REPORT_PERIOD_OVERRIDE_CURRENT: PeriodOverride = null;
const REPORT_PERIOD_OVERRIDE_PREVIOUS: PeriodOverride = null;

const REPORT_SHIFT_WEEKS = 0;

export type ReportTarget = 'current' | 'previous';

type Period = {
  slotStart: Date | null;
  slotEnd: Date | null;
  reportId: string | null;
};

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private fs = inject(Firestore);
  private auth = inject(AuthService);
  private pairCtx = inject(PairContextService);
  private summary = inject(SummaryService);

  /** обновляем раз в ~90 секунд */
  readonly schedule$: Observable<Schedule> = combineLatest([
    this.auth.user$,
    this.pairCtx.activePair$,
    timer(0, 90_000),
  ]).pipe(
    map(([user, pair]) => {
      const now = new Date();

      const { slotStart, slotEnd, nextAt, msToNext, due } = computeCurrentPeriod(now);
      const reportId =
        slotStart && slotEnd ? reportIdFromPeriod(slotStart, slotEnd) : null;

      if (!user || !pair) {
        return {
          inPair: false,
          pairId: null,
          uid: null,
          slotEnd: null,
          slotStart: null,
          reportId: null,
          nextAt,
          msToNext,
          due: false,
        } satisfies Schedule;
      }

      return {
        inPair: true,
        pairId: pair.id || null,
        uid: user.uid,
        slotStart,
        slotEnd,
        reportId,
        nextAt,
        msToNext,
        due,
      } satisfies Schedule;
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  /** Текущий отчёт (для текущего периода schedule.slotStart/slotEnd) */
  readonly report$: Observable<ReportDoc | null> = this.schedule$.pipe(
    switchMap((s) => {
      if (!s.inPair || !s.pairId) return of(null);

      const p = this.periodFor('current', s);
      if (!p.reportId) return of(null);

      const ref = doc(
        this.fs,
        `pairs/${s.pairId}/reports/${p.reportId}`
      ) as unknown as DocumentReference<ReportDoc>;

      return docData(ref, { idField: 'id' }).pipe(
        map((d) => (d ? (d as unknown as ReportDoc) : null)),
        catchError(() => of(null))
      );
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  /** Отчёт за предыдущий период */
  readonly previousReport$: Observable<ReportDoc | null> = this.schedule$.pipe(
    switchMap((s) => {
      if (!s.inPair || !s.pairId) return of(null);

      const p = this.periodFor('previous', s);
      if (!p.reportId) return of(null);

      const ref = doc(
        this.fs,
        `pairs/${s.pairId}/reports/${p.reportId}`
      ) as unknown as DocumentReference<ReportDoc>;

      return docData(ref, { idField: 'id' }).pipe(
        map((d) => (d ? (d as unknown as ReportDoc) : null)),
        catchError(() => of(null))
      );
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );


  periodFor(target: ReportTarget, s: Schedule): Period {
    if (!s.inPair) {
      return { slotStart: null, slotEnd: null, reportId: null };
    }

    if (target === 'current') {
      if (!s.slotStart || !s.slotEnd || !s.reportId) {
        return { slotStart: null, slotEnd: null, reportId: null };
      }
      return { slotStart: s.slotStart, slotEnd: s.slotEnd, reportId: s.reportId };
    }

    // previous
    const prev = computePreviousPeriodFromSchedule(s);
    if (!prev.slotStart || !prev.slotEnd) return { slotStart: null, slotEnd: null, reportId: null };

    return {
      slotStart: prev.slotStart,
      slotEnd: prev.slotEnd,
      reportId: reportIdFromPeriod(prev.slotStart, prev.slotEnd),
    };
  }

  /**
   * Генерация:
   * - current: можно только когда schedule.due === true
   * - previous: можно всегда (если в паре), используем прошлый период
   */
  async generateWeekly(target: ReportTarget = 'current'): Promise<void> {
    const s = await firstValueFrom(this.schedule$.pipe(take(1)));

    if (!s.inPair || !s.pairId || !s.uid) {
      throw new Error('NOT_IN_PAIR');
    }
    if (target === 'current' && !s.due) {
      throw new Error('NOT_DUE_YET');
    }

    const period = this.periodFor(target, s);
    if (!period.slotStart || !period.slotEnd || !period.reportId) {
      throw new Error('NO_PERIOD');
    }

    const uid = s.uid;
    const slotStart = period.slotStart;
    const slotEnd = period.slotEnd;
    const reportId = period.reportId;

    const reportRef = doc(
      this.fs,
      `pairs/${s.pairId}/reports/${reportId}`
    ) as unknown as DocumentReference<ReportDoc>;

    let shouldGenerate = false;

    await runTransaction(this.fs, async (tx) => {
      const snap = await tx.get(reportRef);

      if (snap.exists()) {
        const status = snap.data()?.status;
        if (status === 'ready' || status === 'generating') {
          shouldGenerate = false;
          return;
        }
      }

      shouldGenerate = true;

      const init: WithFieldValue<ReportDoc> = {
        status: 'generating',
        createdAt: serverTimestamp(),
        createdBy: uid,
        periodStart: Timestamp.fromDate(slotStart),
        periodEnd: Timestamp.fromDate(slotEnd),
        summary: null,
        error: null,
        sourceNotes: [],
      };

      tx.set(reportRef, init, { merge: true });
    });

    if (!shouldGenerate) return;

    try {
      const notesCol = collection(this.fs, `pairs/${s.pairId}/notes`);
      const q = query(
        notesCol,
        where('createdAt', '>=', Timestamp.fromDate(slotStart)),
        where('createdAt', '<', Timestamp.fromDate(slotEnd)),
        orderBy('createdAt', 'desc')
      );

      const snap = await getDocs(q);

      const notes = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Note, 'id'>),
      })) as Note[];

      const sourceNotes: ReportSourceNote[] = notes.slice(0, 200).map((n) => ({
        id: n.id,
        text: (n.text ?? '').slice(0, 2000),
        ownerUid: n.ownerUid,
        ownerName: n.ownerName ?? null,
        updatedAt: n.updatedAt ?? null,
      }));

      const summaryText = await firstValueFrom(this.summary.getSummary(notes));

      const readyPatch: UpdateData<ReportDoc> = {
        status: 'ready',
        summary: summaryText,
        error: null,
        notesCount: notes.length,
        sourceNotes,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(reportRef, readyPatch);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'LLM_ERROR';

      const errorPatch: UpdateData<ReportDoc> = {
        status: 'error',
        error: String(msg).slice(0, 500),
        updatedAt: serverTimestamp(),
      };

      await updateDoc(reportRef, errorPatch);
      throw e;
    }
  }
}

// =================== helpers ===================

function computeCurrentPeriod(now: Date): {
  slotStart: Date | null;
  slotEnd: Date | null;
  nextAt: Date | null;
  msToNext: number | null;
  due: boolean;
} {
  // ручной период (CURRENT)
  if (REPORT_PERIOD_OVERRIDE_CURRENT) {
    const slotStart = new Date(REPORT_PERIOD_OVERRIDE_CURRENT.startISO);
    const slotEnd = new Date(REPORT_PERIOD_OVERRIDE_CURRENT.endISO);

    if (isNaN(slotStart.getTime()) || isNaN(slotEnd.getTime())) {
      throw new Error('REPORT_PERIOD_OVERRIDE_CURRENT invalid ISO');
    }
    if (slotStart.getTime() >= slotEnd.getTime()) {
      throw new Error('REPORT_PERIOD_OVERRIDE_CURRENT: start must be < end');
    }

    const nextAt = slotEnd;
    const msToNext = nextAt.getTime() - now.getTime();
    const due = now.getTime() >= slotEnd.getTime();

    return { slotStart, slotEnd, nextAt, msToNext, due };
  }

  // обычная недельная логика: пятница 18:00 текущей недели
  const baseEnd = thisWeekFriday18(now);
  const slotEnd = addDays(baseEnd, REPORT_SHIFT_WEEKS * 7);
  const slotStart = addDays(slotEnd, -7);

  // следующий срок
  const nextAt = now.getTime() < slotEnd.getTime() ? slotEnd : addDays(slotEnd, 7);
  const msToNext = nextAt.getTime() - now.getTime();
  const due = now.getTime() >= slotEnd.getTime();

  return { slotStart, slotEnd, nextAt, msToNext, due };
}

function computePreviousPeriodFromSchedule(s: Schedule): { slotStart: Date | null; slotEnd: Date | null } {
  // ручной период (PREVIOUS)
  if (REPORT_PERIOD_OVERRIDE_PREVIOUS) {
    const slotStart = new Date(REPORT_PERIOD_OVERRIDE_PREVIOUS.startISO);
    const slotEnd = new Date(REPORT_PERIOD_OVERRIDE_PREVIOUS.endISO);

    if (isNaN(slotStart.getTime()) || isNaN(slotEnd.getTime())) {
      throw new Error('REPORT_PERIOD_OVERRIDE_PREVIOUS invalid ISO');
    }
    if (slotStart.getTime() >= slotEnd.getTime()) {
      throw new Error('REPORT_PERIOD_OVERRIDE_PREVIOUS: start must be < end');
    }

    return { slotStart, slotEnd };
  }

  // по умолчанию: предыдущая неделя (slotStart-7д .. slotStart)
  if (!s.slotStart) return { slotStart: null, slotEnd: null };

  const slotEnd = new Date(s.slotStart);
  const slotStart = addDays(slotEnd, -7);
  return { slotStart, slotEnd };
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function fmtId(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}_${pad2(
    d.getHours()
  )}-${pad2(d.getMinutes())}`;
}

/** reportId зависит от start+end, чтобы при ручных периодах не было коллизий */
function reportIdFromPeriod(start: Date, end: Date) {
  return `report_${fmtId(start)}_${fmtId(end)}`;
}

/**
 * Пятница 18:00 текущей недели.
 * Sun(0) считаем как 7, чтобы на выходных получить прошлую пятницу.
 */
function thisWeekFriday18(now: Date): Date {
  const d = new Date(now);
  const day = d.getDay(); // 0..6
  const dayAdj = day === 0 ? 7 : day; // Sun -> 7
  const diff = 5 - dayAdj; // Fri=5
  d.setDate(d.getDate() + diff);
  d.setHours(18, 0, 0, 0);
  return d;
}