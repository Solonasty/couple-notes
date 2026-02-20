import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { DatePipe, NgClass } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, from } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  switchMap,
  tap,
  catchError,
  finalize,
} from 'rxjs/operators';

import { NotesService } from '../../core/services/notes.service';
import { Note } from '../../core/services/pair.types';
import { PairContextService } from '../../core/services/pair-context.service';
import { UiButtonComponent, UiIconComponent } from '@/app/ui';

type DetailMode = 'edit' | 'create';

@Component({
  standalone: true,
  selector: 'app-notes',
  imports: [ReactiveFormsModule, DatePipe,NgClass, UiButtonComponent, UiIconComponent],
  templateUrl: './notes.component.html',
  styleUrl: './notes.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotesComponent {
  private fb = inject(FormBuilder);
  private notesService = inject(NotesService);
  private pairCtx = inject(PairContextService);
  private destroyRef = inject(DestroyRef);
  readonly loading = signal(false);

  // data
  readonly activePair = toSignal(this.pairCtx.activePair$, { initialValue: null });
  readonly inPair = computed(() => !!this.activePair());

  readonly notes = toSignal(this.notesService.notes$(), { initialValue: [] as Note[] });
  readonly notesCount = computed(() => (this.notes() ?? []).length);

  // detail overlay state
  readonly detailMode = signal<DetailMode>('edit');
  readonly openedId = signal<string | null>(null);

  readonly isDetailOpen = computed(() => this.detailMode() === 'create' || !!this.openedId());
  readonly isEditMode = computed(() => this.detailMode() === 'edit');
  readonly deleting = signal(false);
  private readonly paletteSize = 7;

  readonly openedNote = computed<Note | null>(() => {
    const id = this.openedId();
    if (!id) return null;
    return (this.notes() ?? []).find((n) => n.id === id) ?? null;
  });

  // UI state
  readonly closing = signal(false);

  // editor
  readonly editorForm = this.fb.nonNullable.group({
    text: ['', [Validators.maxLength(5000)]],
  });

  // saving state (for edit mode)
  readonly saving = signal(false);
  private lastSavedTrim = signal<string>(''); // trimmed text saved on server

  constructor() {
    // when opening an existing note -> set editor content
    effect(() => {
      if (!this.isDetailOpen()) return;

      if (this.detailMode() === 'create') {
        // new note
        this.editorForm.reset({ text: '' }, { emitEvent: false });
        this.lastSavedTrim.set('');
        this.closing.set(false);
        return;
      }

      // edit existing
      const note = this.openedNote();
      if (!note) return;

      const text = (note.text ?? '').toString();
      this.editorForm.reset({ text }, { emitEvent: false });
      this.lastSavedTrim.set(text.trim());
      this.closing.set(false);
    });

    // autosave only for edit mode
    this.editorForm.controls.text.valueChanges
      .pipe(
        map((v) => (v ?? '').toString()),
        debounceTime(450),
        distinctUntilChanged(),
        filter(() => this.isDetailOpen() && this.isEditMode() && !!this.openedId()),
        map((v) => v.trim()),
        filter((trimmed) => trimmed !== this.lastSavedTrim()),
        switchMap((trimmed) => {
          const id = this.openedId();
          if (!id) return EMPTY;

          this.saving.set(true);
          return from(this.notesService.update(id, trimmed)).pipe(
            tap(() => this.lastSavedTrim.set(trimmed)),
            finalize(() => this.saving.set(false)),
            catchError(() => {
              this.saving.set(false);
              return EMPTY;
            })
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();

    // if note disappears while open (например удалили) -> закрыть
    effect(() => {
      if (!this.isDetailOpen()) return;

      if (
        this.isEditMode() &&
        this.openedId() &&
        !this.openedNote() &&
        !this.closing() &&
        !this.deleting()
      ) {
        void this.close(false);
      }
    });

    // safety: flush on destroy
    this.destroyRef.onDestroy(() => void this.flushSave());
  }

  // ===== OPENERS =====

  openNew() {
    if (!this.inPair()) return;
    if (this.isDetailOpen()) return;

    this.detailMode.set('create');
    this.openedId.set(null);
    this.closing.set(false);
  }

  openExisting(id: string) {
    if (!this.inPair()) return;
    if (this.isDetailOpen()) return;

    const note = (this.notes() ?? []).find((n) => n.id === id);
    if (!note) return;

    this.detailMode.set('edit');
    this.openedId.set(id);
    this.closing.set(false);
  }

  // ===== ACTIONS =====

  async back() {
    await this.close(true);
  }

  async deleteCurrent() {
    if (!this.isEditMode()) return;
    const id = this.openedId();
    if (!id) return;

    this.deleting.set(true);

    this.closing.set(true);
    await new Promise((r) => setTimeout(r, 200));
    this.resetDetailState();

    try {
      await this.notesService.remove(id);
    } finally {
      this.deleting.set(false);
    }
  }


  private async close(animate: boolean) {
    await this.flushSave();

    if (animate) {
      this.closing.set(true);
      await new Promise((r) => setTimeout(r, 200));
    }

    this.resetDetailState();
  }

  private resetDetailState() {
    this.closing.set(false);
    this.detailMode.set('edit');
    this.openedId.set(null);
  }

  private async flushSave() {
    const textTrim = (this.editorForm.controls.text.value ?? '').toString().trim();

    // CREATE: create on close if user typed anything
    if (this.detailMode() === 'create') {
      if (textTrim.length === 0) return;
      await this.notesService.add(textTrim);
      return;
    }

    // EDIT: update on close if changed
    const id = this.openedId();
    if (!id) return;

    if (textTrim === this.lastSavedTrim()) return;

    try {
      this.saving.set(true);
      await this.notesService.update(id, textTrim);
      this.lastSavedTrim.set(textTrim);
    } finally {
      this.saving.set(false);
    }
  }

  private hashToIndex(seed: string, mod: number): number {
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
      h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    }
    return h % mod;
  }

  noteColorClass(_: Note, index: number): string {
    return `note--${index % this.paletteSize}`;
  }

}
