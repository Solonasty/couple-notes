import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  ViewEncapsulation,
} from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

type NoteForm = FormGroup<{ text: FormControl<string> }>;

@Component({
  standalone: true,
  selector: 'ui-card',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  templateUrl: './ui-card.component.html',
  styleUrl: './ui-card.component.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiCardComponent {
  @Input({ required: true }) form!: NoteForm;

  // Визуальные режимы
  @Input() showTitle = true;      // create: true, edit: false
  @Input() dense = false;         // edit: true
  @Input() accent = true;         // create: true (бордер слева), edit: false

  @Input() title = 'Новая заметка';

  /** как “дата” в карточке заметки */
  @Input() meta?: string;

  @Input() label = 'Текст заметки';
  @Input() placeholder = 'Напишите заметку…';
  @Input() rows = 4;
  @Input() maxLength = 5000;

  @Input() cancelText = 'Отмена';
  @Input() saveText = 'Сохранить';
  @Input() busy = false;

  @Output() cancel = new EventEmitter<void>();
  @Output() save = new EventEmitter<void>();

  get count(): number {
    return this.form?.controls?.text?.value?.length ?? 0;
  }
}
