import {
  ChangeDetectionStrategy,
  Component,
  Input,
  Optional,
  Self,
  ViewEncapsulation,
} from '@angular/core';
import { ControlValueAccessor, NgControl } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  standalone: true,
  selector: 'ui-input',
  imports: [MatFormFieldModule, MatInputModule],
  templateUrl: './ui-input.component.html',
  styleUrl: './ui-input.component.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiInputComponent implements ControlValueAccessor {
  @Input() type: 'text' | 'email' | 'password' | 'tel' | 'url' = 'text';
  @Input() placeholder = '';
  @Input() autocomplete?: string;
  @Input() ariaLabel?: string;

  @Input() hint?: string;
  @Input() showErrorsOn: 'touched' | 'dirty' | 'always' = 'touched';

  @Input() errorsText: Partial<
    Record<'required' | 'email' | 'minlength' | 'maxlength' | 'pattern', string>
  > = {};

  value = '';
  disabled = false;

  private _onChange: (v: string) => void = () => {};
  private _onTouched: () => void = () => {};

  constructor(@Optional() @Self() public ngControl: NgControl) {
    if (this.ngControl) this.ngControl.valueAccessor = this;
  }

  writeValue(v: string | null): void {
    this.value = v ?? '';
  }

  registerOnChange(fn: (v: string) => void): void {
    this._onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this._onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onInput(e: Event) {
    const v = (e.target as HTMLInputElement).value;
    this.value = v;
    this._onChange(v);
  }

  markTouched(): void {
    this._onTouched();
  }

  private get control() {
    return this.ngControl?.control ?? null;
  }

  get shouldShowError(): boolean {
    const c = this.control;
    if (!c || !c.errors) return false;

    if (this.showErrorsOn === 'always') return true;
    if (this.showErrorsOn === 'dirty') return c.dirty;
    return c.touched;
  }

  get errorMessage(): string | null {
    const c = this.control;
    if (!c || !this.shouldShowError || !c.errors) return null;

    if (c.hasError('required')) return this.errorsText.required ?? 'Обязательное поле';
    if (c.hasError('email')) return this.errorsText.email ?? 'Некорректный email';

    if (c.hasError('minlength')) {
      const req = c.getError('minlength')?.requiredLength;
      return this.errorsText.minlength ?? `Минимум ${req} символов`;
    }

    if (c.hasError('maxlength')) {
      const req = c.getError('maxlength')?.requiredLength;
      return this.errorsText.maxlength ?? `Максимум ${req} символов`;
    }

    if (c.hasError('pattern')) return this.errorsText.pattern ?? 'Неверный формат';

    return 'Неверное значение';
  }

  get isInvalid(): boolean {
    return !!this.errorMessage;
  }
}
