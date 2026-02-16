import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type UiButtonVariant = 'primary' | 'accent' | 'black' | 'outline' | 'ghost' | 'danger';
export type UiButtonSize = 'sm' | 'md' | 'lg';

@Component({
  standalone: true,
  selector: 'ui-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ui-button.component.html',
  styleUrl: './ui-button.component.scss',
})
export class UiButtonComponent {
  @Input() variant: UiButtonVariant = 'primary';
  @Input() size: UiButtonSize = 'md';

  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() full = false;

  @Input() disabled = false;
  @Input() loading = false;

  @Input() hideContentWhileLoading = false;

  get isDisabled() {
    return this.disabled || this.loading;
  }

  get classList(): string[] {
    return [
      'ui-btn',
      `ui-btn--${this.variant}`,
      `ui-btn--${this.size}`,
      this.full ? 'ui-btn--full' : '',
      this.loading ? 'ui-btn--loading' : '',
    ].filter(Boolean);
  }
}
