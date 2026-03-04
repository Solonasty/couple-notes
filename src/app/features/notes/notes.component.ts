import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { DatePipe, NgClass } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed, toSignal, toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, from } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, filter, map, switchMap, tap } from 'rxjs/operators';

import { NotesService } from '../../core/services/notes.service';
import { PairContextService } from '../../core/services/pair-context.service';
import { UiButtonComponent, UiIconComponent } from '@/app/ui';
import { Note } from '@/app/core/models/note.type';

type DetailState =
  | { kind: 'closed' }
  | { kind: 'create' }
  | { kind: 'edit'; id: string };

@Component({
  standalone: true,
  selector: 'app-notes',
  imports: [ReactiveFormsModule, DatePipe, NgClass, UiButtonComponent, UiIconComponent],
  templateUrl: './notes.component.html',
  styleUrl: './notes.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotesComponent {
  private readonly fb = inject(FormBuilder);
  private readonly notesService = inject(NotesService);
  private readonly pairCtx = inject(PairContextService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly closeAnimMs = 200;
  private readonly paletteSize = 7;

  // ========= DATA =========
  readonly activePair = toSignal(this.pairCtx.activePair$, { initialValue: null });
  readonly inPair = computed(() => !!this.activePair());

  readonly notes = toSignal(this.notesService.notes$(), { initialValue: [] as Note[] });
  readonly notesCount = computed(() => (this.notes() ?? []).length);

  // ========= DETAIL STATE =========
  private readonly detail = signal<DetailState>({ kind: 'closed' });

  readonly isDetailOpen = computed(() => this.detail().kind !== 'closed');
  readonly isEditMode = computed(() => this.detail().kind === 'edit');

  readonly openedId = computed(() => {
    const d = this.detail();
    return d.kind === 'edit' ? d.id : null;
  });

  readonly openedNote = computed<Note | null>(() => {
    const id = this.openedId();
    if (!id) return null;
    return (this.notes() ?? []).find((n) => n.id === id) ?? null;
  });

  // ========= UI STATE =========
  readonly closing = signal(false);
  readonly deleting = signal(false);

  readonly saving = signal(false);
  readonly loading = computed(() => this.saving() || this.deleting());

  // ========= EDITOR =========
  readonly textCtrl = this.fb.nonNullable.control('', [Validators.maxLength(5000)]);
  readonly editorForm = this.fb.nonNullable.group({ text: this.textCtrl });

  readonly draftText = signal<string>('');
  private readonly lastSavedTrim = signal<string>('');
  private readonly hydratedKey = signal<string | null>(null);
  readonly currentTrim = computed(() => this.draftText().trim());

  private lastSavePromise: Promise<void> = Promise.resolve();

  readonly hasChanges = computed(() => {
    const d = this.detail();
    const trim = this.currentTrim();

    if (d.kind === 'create') return trim.length > 0;
    if (d.kind === 'edit') return trim !== this.lastSavedTrim();
    return false;
  });

  constructor() {
    this.textCtrl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => this.draftText.set((v ?? '').toString()));

    effect(() => {
      const d = this.detail();

      if (d.kind === 'closed') return;

      if (d.kind === 'create') {
        this.hydrateCreate();
        return;
      }

      // edit
      const note = this.openedNote();
      if (!note) return;
      this.hydrateEdit(d.id, note);
    });

    toObservable(this.detail)
      .pipe(
        switchMap((d) => {
          if (d.kind !== 'edit') return EMPTY;

          return this.textCtrl.valueChanges.pipe(
            map((v) => (v ?? '').toString()),
            debounceTime(450),
            distinctUntilChanged(),
            map((v) => v.trim()),
            filter((trim) => trim !== this.lastSavedTrim()),
            switchMap((trim) =>
              from(this.queueSave(async () => {
                await this.notesService.update(d.id, trim);
                this.lastSavedTrim.set(trim);
              })).pipe(
                catchError(() => EMPTY)
              )
            )
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      ).subscribe();

    effect(() => {
      const d = this.detail();
      if (d.kind !== 'edit') return;

      if (!this.openedNote() && !this.closing() && !this.deleting()) {
        void this.close(false);
      }
    });
    this.destroyRef.onDestroy(() => void this.flushSave());
  }

  // ========= OPENERS =========

  openNew(): void {
    if (!this.inPair()) return;
    if (this.isDetailOpen()) return;

    this.detail.set({ kind: 'create' });
    this.closing.set(false);
  }

  openExisting(id: string): void {
    if (!this.inPair()) return;
    if (this.isDetailOpen()) return;

    const exists = (this.notes() ?? []).some((n) => n.id === id);
    if (!exists) return;

    this.detail.set({ kind: 'edit', id });
    this.closing.set(false);
  }

  // ========= ACTIONS =========

  async back(): Promise<void> {
    await this.close(true);
  }

  async deleteCurrent(): Promise<void> {
    const d = this.detail();
    if (d.kind !== 'edit') return;

    const id = d.id;
    this.deleting.set(true);

    try {
      await this.close(true);
      await this.notesService.remove(id);
    } finally {
      this.deleting.set(false);
    }
  }

  // ========= INTERNAL =========

  private hydrateCreate(): void {
    const key = 'create';
    if (this.hydratedKey() === key) return;

    this.hydratedKey.set(key);
    this.lastSavedTrim.set('');
    this.closing.set(false);
    this.setEditorText('');
  }

  private hydrateEdit(id: string, note: Note): void {
    if (this.hydratedKey() === id) return;

    this.hydratedKey.set(id);

    const text = (note.text ?? '').toString();
    this.lastSavedTrim.set(text.trim());
    this.closing.set(false);
    this.setEditorText(text);
  }

  private setEditorText(text: string): void {
    this.draftText.set(text);
    this.textCtrl.setValue(text, { emitEvent: false });

    this.editorForm.markAsPristine();
    this.editorForm.markAsUntouched();
  }

  private async close(animate: boolean): Promise<void> {
    await this.flushSave();

    if (animate) {
      this.closing.set(true);
      await new Promise((r) => setTimeout(r, this.closeAnimMs));
    }

    this.resetDetailState();
  }

  private resetDetailState(): void {
    this.hydratedKey.set(null);
    this.closing.set(false);
    this.detail.set({ kind: 'closed' });
  }

  private queueSave(op: () => Promise<void>): Promise<void> {
    const run = async () => {
      this.saving.set(true);
      try {
        await op();
      } finally {
        this.saving.set(false);
      }
    };

    this.lastSavePromise = this.lastSavePromise
      .catch(() => undefined)
      .then(run);

    return this.lastSavePromise;
  }

  private async flushSave(): Promise<void> {
    await this.lastSavePromise.catch(() => undefined);

    const d = this.detail();
    if (d.kind === 'closed') return;

    const trim = (this.textCtrl.value ?? '').toString().trim();

    if (d.kind === 'create') {
      if (trim.length === 0) return;

      try {
        await this.queueSave(async () => {
          await this.notesService.add(trim);
        });
      } catch {
      }

      return;
    }

    // edit
    if (trim === this.lastSavedTrim()) return;

    try {
      await this.queueSave(async () => {
        await this.notesService.update(d.id, trim);
        this.lastSavedTrim.set(trim);
      });
    } catch {
      // тихо
    }
  }

  noteColorClass(_: Note, index: number): string {
    return `note--${index % this.paletteSize}`;
  }
}