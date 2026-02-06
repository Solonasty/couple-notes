import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDividerModule } from '@angular/material/divider';
import { Note, NotesService } from '../../core/services/notes.service';

@Component({
  standalone: true,
  selector: 'app-notes',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatDividerModule,
    DatePipe,
  ],
  templateUrl: './notes.component.html',
  styleUrl: './notes.component.scss',
})
export class NotesComponent {
  private fb = new FormBuilder();
  private notesService = inject(NotesService);

  readonly isAdding = signal(false);

  // Список заметок — signal из Firestore
  readonly notes = toSignal(this.notesService.notes$(), { initialValue: [] as Note[] });
  readonly notesCount = computed(() => (this.notes() ?? []).length);


  readonly form = this.fb.nonNullable.group({
    text: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(5000)]],
  });

  openAdd() { this.isAdding.set(true); this.form.reset({ text: '' }); }
  cancelAdd() { this.isAdding.set(false); this.form.reset({ text: '' }); }

  async addNote() {
    if (this.form.invalid) return;
    const text = this.form.getRawValue().text.trim();
    if (!text) return;

    await this.notesService.add(text);

    this.isAdding.set(false);
    this.form.reset({ text: '' });
  }

  readonly editingId = signal<string | null>(null);

readonly editForm = this.fb.nonNullable.group({
  text: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(5000)]],
});

startEdit(note: Note) {
  this.editingId.set(note.id);
  this.editForm.reset({ text: note.text });
}

cancelEdit() {
  this.editingId.set(null);
  this.editForm.reset({ text: '' });
}

async saveEdit(noteId: string) {
  if (this.editForm.invalid) return;
  const text = this.editForm.getRawValue().text.trim();
  if (!text) return;

  await this.notesService.update(noteId, text);
  this.cancelEdit();
}



  async deleteNote(id: string) {
    await this.notesService.remove(id);
  }
}
