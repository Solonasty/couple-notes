import { Component, computed, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDividerModule } from '@angular/material/divider';
import { DatePipe } from '@angular/common';

type Note = {
  id: string;
  text: string;
  createdAt: number;
};

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

  readonly isAdding = signal(false);

  readonly notes = signal<Note[]>([]);
  readonly notesCount = computed(() => this.notes().length);

  readonly form = this.fb.nonNullable.group({
    text: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(5000)]],
  });

  openAdd() {
    this.isAdding.set(true);
    this.form.reset({ text: '' });
  }

  cancelAdd() {
    this.isAdding.set(false);
    this.form.reset({ text: '' });
  }

  addNote() {
    if (this.form.invalid) return;

    const text = this.form.getRawValue().text.trim();
    if (!text) return;

    const note: Note = {
      id: crypto.randomUUID(),
      text,
      createdAt: Date.now(),
    };

    // добавляем сверху (последняя заметка первой)
    this.notes.update(list => [note, ...list]);

    this.isAdding.set(false);
    this.form.reset({ text: '' });
  }

  deleteNote(id: string) {
    this.notes.update(list => list.filter(n => n.id !== id));
  }

}
