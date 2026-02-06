import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

import { NotesService, Note } from '../../core/services/notes.service';
import { SummaryService } from '../../core/services/summary.service';
import { firstValueFrom } from 'rxjs';

@Component({
  standalone: true,
  selector: 'app-weekly',
  imports: [MatButtonModule, MatCardModule],
  templateUrl: './weekly.component.html',
})
export class WeeklyComponent {
  private notesService = inject(NotesService);
  private summaryService = inject(SummaryService);

  notes = toSignal(this.notesService.notes$(), { initialValue: [] as Note[] });

  summary = signal<string | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  async generate() {
    this.loading.set(true);
    this.error.set(null);

    try {
      const text = await firstValueFrom(this.summaryService.getSummary(this.notes() ?? []));
this.summary.set(text);

    } catch {
      this.error.set('Ошибка получения сводки');
    } finally {
      this.loading.set(false);
    }
  }
}
