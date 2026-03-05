import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { ReportsService, ReportTarget } from '../../core/services/reports.service';
import { ReportDoc, ReportSourceNote } from '@/app/core/models/report-doc.type';
import { Schedule } from '@/app/core/models/schedule.type';

const SCHEDULE_INIT: Schedule = {
  inPair: false,
  pairId: null,
  uid: null,
  slotEnd: null,
  slotStart: null,
  reportId: null,
  nextAt: null,
  msToNext: null,
  due: false,
};

@Component({
  standalone: true,
  selector: 'app-weekly',
  imports: [],
  templateUrl: './weekly.component.html',
  styleUrl: './weekly.component.scss',
})
export class WeeklyComponent {
  private reports = inject(ReportsService);

  schedule = toSignal(this.reports.schedule$, { initialValue: SCHEDULE_INIT });

  report = toSignal<ReportDoc | null | undefined>(this.reports.report$, { initialValue: undefined });
  previousReport = toSignal<ReportDoc | null | undefined>(this.reports.previousReport$, { initialValue: undefined });

  summary = signal<string | null>(null);
  uiError = signal<string | null>(null);
  loading = signal(false);

  private sched = computed<Schedule>(() => this.schedule() ?? SCHEDULE_INIT);

  target = computed<ReportTarget>(() => (this.sched().due ? 'current' : 'previous'));

  private targetReport = computed<ReportDoc | null | undefined>(() => {
    return this.target() === 'current' ? this.report() : this.previousReport();
  });

  private readyReport = computed<ReportDoc | null>(() => {
    const r = this.targetReport();
    return r && r.status === 'ready' ? r : null;
  });

  private autoKey = signal<string | null>(null);
  private autoTriggered = signal(false);

  sourceNotes = computed<ReportSourceNote[]>(() => this.readyReport()?.sourceNotes ?? []);
  hasSourceNotes = computed(() => this.sourceNotes().length > 0);

  periodText = computed(() => {
    const s = this.sched();
    const p = this.reports.periodFor(this.target(), s);
    if (!p.slotStart || !p.slotEnd) return '';
    return `${formatDate(p.slotStart)} — ${formatDate(p.slotEnd)}`;
  });

  canGenerate = computed(() => {
    const s = this.sched();
    if (!s.inPair) return false;

    if (this.target() === 'current' && !s.due) return false;

    const r = this.targetReport();
    if (r?.status === 'ready' || r?.status === 'generating') return false;

    return true;
  });

  canGet = computed(() => !!this.readyReport());

  statusText = computed(() => {
    const s = this.sched();
    const r = this.targetReport();
    const eta = s.msToNext != null ? formatEta(s.msToNext) : '';

    if (!s.inPair) return 'Вступите в пару, чтобы получать отчёты.';

    // когда due ещё нет — мы работаем с предыдущим отчётом
    if (!s.due) {
      if (r?.status === 'generating') return `Генерация отчёта за предыдущий период... Следующий отчет будет готов через ${eta}.`;
      if (r?.status === 'error') return `Ошибка генерации отчёта за предыдущий период. Включите VPN и попробуйте снова. Следующий отчет будет готов через ${eta}.`;
      if (r?.status === 'ready') return `Отчёт готов! Следующий отчет можно будет получить через ${eta} (в пятницу в 18:00).`;
      return `Готовлю отчёт за предыдущий период. Следующий отчет будет готов через ${eta} (в пятницу в 18:00).`;
    }

    // due наступил — работаем с текущим
    if (r?.status === 'generating') return `Генерация отчёта... Следующий отчет будет готов через ${eta}.`;
    if (r?.status === 'error') return `Ошибка генерации отчёта. Включите VPN и попробуйте снова. Следующий отчет будет готов через ${eta}.`;
    if (r?.status === 'ready') return `Отчёт готов! Следующий отчет можно будет получить через ${eta} (в пятницу в 18:00).`;

    return `Можно сформировать отчёт. Следующий отчет будет готов через ${eta} (в пятницу в 18:00).`;
  });

  constructor() {
    // 1) Как только готов — показываем автоматически
    effect(() => {
      const ready = this.readyReport();
      if (ready) this.summary.set(ready.summary ?? '');
    });

    // 2) Автогенерация при входе/смене периода:
    // - если ready нет, и не generating -> запускаем один раз
    effect(() => {
      const s = this.sched();

      if (!s.inPair) {
        this.summary.set(null);
        this.uiError.set(null);
        this.autoKey.set(null);
        this.autoTriggered.set(false);
        return;
      }

      // ждём, пока расписание реально заполнится
      if (!s.slotStart || !s.slotEnd) return;

      const t = this.target();
      const p = this.reports.periodFor(t, s);
      if (!p.slotStart || !p.slotEnd || !p.reportId) return;

      // ждём, пока target report реально загрузится
      const tr = this.targetReport();
      if (tr === undefined) return;

      // если уже готов/в процессе — ничего не делаем
      if (tr && (tr.status === 'ready' || tr.status === 'generating')) return;

      // уникальный ключ периода
      const key = `${t}|${s.pairId ?? ''}|${p.reportId}`;
      if (this.autoKey() !== key) {
        this.autoKey.set(key);
        this.autoTriggered.set(false);
        this.uiError.set(null);
        this.summary.set(null);
      }

      if (this.autoTriggered()) return;
      this.autoTriggered.set(true);

      void this.generateAuto(t);
    });
  }

  async generate() {
    this.loading.set(true);
    this.uiError.set(null);
    this.summary.set(null);

    try {
      await this.reports.generateWeekly(this.target());
    } catch {
      this.uiError.set('Ошибка получения отчёта. Включите VPN и попробуйте снова.');
    } finally {
      this.loading.set(false);
    }
  }

  getReport() {
    const r = this.readyReport();
    if (r) this.summary.set(r.summary ?? '');
  }

  private async generateAuto(target: ReportTarget) {
    this.loading.set(true);
    this.uiError.set(null);

    try {
      await this.reports.generateWeekly(target);
      // summary появится автоматически, когда report станет ready
    } catch {
      this.uiError.set('Ошибка получения отчёта. Включите VPN и попробуйте снова.');
    } finally {
      this.loading.set(false);
    }
  }
}

function formatEta(ms: number) {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(totalMin / (60 * 24));
  const h = Math.floor((totalMin % (60 * 24)) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d}д ${h}ч`;
  if (h > 0) return `${h}ч ${m}м`;
  return `${m}м`;
}

function formatDate(d: Date) {
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function formatDt(d: Date) {
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}