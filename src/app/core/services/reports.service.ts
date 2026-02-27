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
  type FieldValue,
  type WithFieldValue,
  type UpdateData,
} from 'firebase/firestore';

import { AuthService } from './auth.service';
import { PairContextService } from './pair-context.service';
import { SummaryService } from './summary.service';
import { Note } from '../models/note.type';
import {  ReportDoc, ReportSourceNote } from '../models/report-doc.type';

import { FsTime } from '../models/fs-time.type';
import { Schedule } from '../models/schedule.type';

// const REPORT_PERIOD_OVERRIDE: { startISO: string; endISO: string } | null = {
//   startISO: '2026-02-06T18:00:00+03:00',
//   endISO: '2026-02-13T18:00:00+03:00',
// };

const REPORT_PERIOD_OVERRIDE: { startISO: string; endISO: string } | null = {
  startISO: '2026-02-11T18:00:00+03:00',
  endISO: '2026-02-24T16:00:00+03:00',
};
// const REPORT_PERIOD_OVERRIDE: { startISO: string; endISO: string } | null = null;

const REPORT_SHIFT_WEEKS = 0;

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private fs = inject(Firestore);
  private auth = inject(AuthService);
  private pairCtx = inject(PairContextService);
  private summary = inject(SummaryService);

  /** обновляем раз в минуту */
  readonly schedule$: Observable<Schedule> = combineLatest([
    this.auth.user$,
    this.pairCtx.activePair$,
    timer(0, 90_000),
  ]).pipe(
    map(([user, pair]) => {
      const now = new Date();

      const { slotStart, slotEnd, nextAt, msToNext, due } = computePeriod(now);
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

  readonly report$: Observable<ReportDoc | null> = this.schedule$.pipe(
    switchMap((s) => {
      if (!s.inPair || !s.pairId || !s.reportId) return of(null);

      const ref = doc(
        this.fs,
        `pairs/${s.pairId}/reports/${s.reportId}`
      ) as unknown as DocumentReference<ReportDoc>;

      // docData(idField:'id') требует, чтобы key существовал в типе
      const refWithId =
        ref as unknown as DocumentReference<ReportDoc>;

      return docData(refWithId, { idField: 'id' }).pipe(
        map((d) => (d ? (d as unknown as ReportDoc) : null)),
        catchError(() => of(null))
      );
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  async generateWeekly(): Promise<void> {
    const s = await firstValueFrom(this.schedule$.pipe(take(1)));

    if (!s.inPair || !s.pairId || !s.uid || !s.slotStart || !s.slotEnd || !s.reportId) {
      throw new Error('NOT_IN_PAIR');
    }
    if (!s.due) {
      throw new Error('NOT_DUE_YET');
    }

    // теперь типы точно string/Date
    const uid = s.uid;
    const slotStart = s.slotStart;
    const slotEnd = s.slotEnd;

    const reportRef = doc(
      this.fs,
      `pairs/${s.pairId}/reports/${s.reportId}`
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

      const sourceNotes: ReportSourceNote[] = notes.slice(0, 200).map((n) => {
        const r = n as unknown as Record<string, unknown>;

        const text = typeof r['text'] === 'string' ? r['text'] : '';
        const ownerUid = typeof r['ownerUid'] === 'string' ? r['ownerUid'] : '';
        const updatedAt = (r['updatedAt'] ?? null) as FsTime;

        return {
          id: n.id,
          text: text.slice(0, 2000),
          ownerUid,
          updatedAt,
        };
      });

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

function computePeriod(now: Date): {
  slotStart: Date | null;
  slotEnd: Date | null;
  nextAt: Date | null;
  msToNext: number | null;
  due: boolean;
} {
  // ручной период
  if (REPORT_PERIOD_OVERRIDE) {
    const slotStart = new Date(REPORT_PERIOD_OVERRIDE.startISO);
    const slotEnd = new Date(REPORT_PERIOD_OVERRIDE.endISO);

    if (isNaN(slotStart.getTime()) || isNaN(slotEnd.getTime())) {
      throw new Error('REPORT_PERIOD_OVERRIDE invalid ISO');
    }
    if (slotStart.getTime() >= slotEnd.getTime()) {
      throw new Error('REPORT_PERIOD_OVERRIDE: start must be < end');
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
  return `report_${fmtId(start)}__${fmtId(end)}`;
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
