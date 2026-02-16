import {
    ChangeDetectionStrategy,
    Component,
    Input,
    Optional,
    Self,
  } from '@angular/core';
  import { ControlValueAccessor, NgControl } from '@angular/forms';
  
  @Component({
    standalone: true,
    selector: 'ui-input',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './ui-input.component.html',
    styleUrl: './ui-input.component.scss',
  })
  export class UiInputComponent implements ControlValueAccessor {
    @Input() label = '';
    @Input() placeholder = '';
    @Input() autocomplete: string | null = null;
    @Input() type: 'text' | 'email' | 'password' = 'text';
    @Input() full = true;
  
    value = '';
    isDisabled = false;
  
    constructor(@Self() @Optional() public ngControl: NgControl | null) {
      if (this.ngControl) this.ngControl.valueAccessor = this;
    }
  
    // --- errors ---
    get showError(): boolean {
      const c = this.ngControl?.control;
      return !!c && c.invalid && (c.touched || c.dirty);
    }
  
    get errorText(): string {
      const e = this.ngControl?.control?.errors;
      if (!e) return '';
      if (e['required']) return 'Обязательное поле';
      if (e['email']) return 'Неверный email';
      if (e['minlength']) return `Минимум ${e['minlength'].requiredLength} символов`;
      return 'Поле заполнено неверно';
    }
  
    // --- CVA ---
    private onChange: (v: string) => void = () => {};
    private onTouched: () => void = () => {};
  
    writeValue(v: string | null): void {
      this.value = v ?? '';
    }
  
    registerOnChange(fn: (v: string) => void): void {
      this.onChange = fn;
    }
  
    registerOnTouched(fn: () => void): void {
      this.onTouched = fn;
    }
  
    setDisabledState(isDisabled: boolean): void {
      this.isDisabled = isDisabled;
    }
  
    onInputEvent(event: Event) {
      const input = event.target as HTMLInputElement;
      this.value = input.value;
      this.onChange(input.value);
    }
  
    onBlur() {
      this.onTouched();
    }
  }
  