import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import {
  ReportsService,
} from '../../core/services/reports.service';

import { UiButtonComponent } from '@/app/ui';
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
  imports: [UiButtonComponent],
  templateUrl: './weekly.component.html',
  styleUrl: './weekly.component.scss',
})
export class WeeklyComponent {
  private reports = inject(ReportsService);

  schedule = toSignal(this.reports.schedule$, { initialValue: SCHEDULE_INIT });
  report = toSignal(this.reports.report$, { initialValue: null as ReportDoc | null });

  summary = signal<string | null>(null);
  uiError = signal<string | null>(null);
  loading = signal(false);

  private sched = computed<Schedule>(() => this.schedule() ?? SCHEDULE_INIT);

  sourceNotes = computed<ReportSourceNote[]>(() => this.report()?.sourceNotes ?? []);
  hasSourceNotes = computed(() => this.sourceNotes().length > 0);

  periodText = computed(() => {
    const s = this.sched();
    if (!s.slotStart || !s.slotEnd) return '';
    return `${formatDt(s.slotStart)} — ${formatDt(s.slotEnd)}`;
  });

  canGenerate = computed(() => {
    const s = this.sched();
    const r = this.report();

    if (!s.inPair) return false;
    if (!s.due) return false;
    if (r?.status === 'ready' || r?.status === 'generating') return false;

    return true;
  });

  canGet = computed(() => this.report()?.status === 'ready');

  statusText = computed(() => {
    const s = this.sched();
    const r = this.report();

    const eta = s.msToNext != null ? formatEta(s.msToNext) : '';

    if (!s.inPair) return 'Вступите в пару, чтобы получать отчёты.';
    if (!s.due) return `Отчёт можно будет сформировать через ${eta} (в пятницу в 18:00).`;

    if (r?.status === 'generating') return `Генерация отчёта... Следующий срок через ${eta}.`;
    if (r?.status === 'error') return `Ошибка генерации отчёта. Включите VPN и попробуйте снова. Следующий срок через ${eta}.`;
    if (r?.status === 'ready') return `Отчёт готов. Следующий срок через ${eta}.`;

    return `Можно сформировать отчёт. Следующий срок через ${eta}.`;
  });

  async generate() {
    this.loading.set(true);
    this.uiError.set(null);
    this.summary.set(null);

    try {
      await this.reports.generateWeekly();
    } catch {
      this.uiError.set('Ошибка получения отчёта. Включите VPN и попробуйте снова.');
    } finally {
      this.loading.set(false);
    }
  }

  getReport() {
    const r = this.report();
    if (r?.status === 'ready') this.summary.set(r.summary ?? '');
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

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function formatDt(d: Date) {
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}