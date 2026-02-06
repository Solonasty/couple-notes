import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, map, throwError, timeout } from 'rxjs';

import { buildWeeklySummaryPrompt } from './summary-prompt';
import { Note } from './notes.service';


@Injectable({ providedIn: 'root' })
export class SummaryService {
  private http = inject(HttpClient);

  // ✅ твой Worker URL
  private readonly url = 'https://couple-notes-worker.solonasty93.workers.dev/summarize';

  getSummary(notes: Note[]) {
    const prompt = buildWeeklySummaryPrompt(notes);

    return this.http
      .post<{ summary: string }>(
        this.url,
        { prompt },
        { responseType: 'json' as const }
      )
      // ✅ если воркер долго думает/сеть тормозит — упадёт через 20 сек
      .pipe(
        timeout(20_000),
        map(r => r.summary),
        catchError(err => throwError(() => toHttpDebugError(err)))
      );
  }
}

function toHttpDebugError(err: unknown): Error {
  // timeout() кидает обычный Error
  if (err instanceof Error && !(err instanceof HttpErrorResponse)) {
    return new Error(`TIMEOUT: ${err.message || 'Request timed out'}`);
  }

  if (err instanceof HttpErrorResponse) {
    // status 0 = сеть/CORS/blocked
    if (err.status === 0) {
      return new Error(
        `NETWORK/CORS (status 0): ${err.message || 'Unknown Error'}`
      );
    }

    const serverText =
      typeof err.error === 'string'
        ? err.error.slice(0, 300)
        : (err.error ? JSON.stringify(err.error).slice(0, 300) : '');

    return new Error(
      `HTTP ${err.status} ${err.statusText || ''}${serverText ? `: ${serverText}` : ''}`
    );
  }

  return new Error('UNKNOWN_ERROR');
}