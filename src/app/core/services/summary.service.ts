import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, map, throwError, timeout } from 'rxjs';

import { buildWeeklySummaryPrompt } from './summary-prompt';
import { Note } from '../models/note.type';


@Injectable({ providedIn: 'root' })
export class SummaryService {
  private http = inject(HttpClient);

  private readonly url =
    'https://couple-notes-worker.solonasty93.workers.dev/summarize';

  getSummary(notes: Note[]) {
    const input = buildWeeklySummaryPrompt(notes).trim();

    return this.http
      .post<{ summary: string }>(
        this.url,
        { input }, // ✅ важно: input, не prompt
        { responseType: 'json' as const }
      )
      .pipe(
        timeout(90_000),
        map(r => (r?.summary ?? '').trim()),
        catchError(err => throwError(() => toHttpDebugError(err)))
      );
  }
}

function toHttpDebugError(err: unknown): Error {
  if (err instanceof Error && !(err instanceof HttpErrorResponse)) {
    return new Error(`TIMEOUT: ${err.message || 'Request timed out'}`);
  }

  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) {
      return new Error(`NETWORK/CORS (status 0): ${err.message || 'Unknown Error'}`);
    }

    // если сервер вернул json {summary: "..."} или {error: "..."} — покажем
    let serverText = '';
    if (typeof err.error === 'string') {
      serverText = err.error.slice(0, 500);
    } else if (err.error) {
      try {
        serverText = JSON.stringify(err.error).slice(0, 500);
      } catch {
        serverText = String(err.error).slice(0, 500);
      }
    }

    return new Error(
      `HTTP ${err.status} ${err.statusText || ''}${serverText ? `: ${serverText}` : ''}`
    );
  }

  return new Error('UNKNOWN_ERROR');
}