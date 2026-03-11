import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type UiButtonVariant = 'solid' | 'outline' | 'ghost' | 'next';
export type UiButtonSize = 'sm' | 'md' | 'lg';
export type UiButtonColor = 'primary' | 'neutral' | 'danger' | 'brand';

@Component({
  standalone: true,
  selector: 'ui-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ui-button.component.html',
  styleUrl: './ui-button.component.scss',
})
export class UiButtonComponent {
  @Input() variant: UiButtonVariant = 'solid';
  @Input() size: UiButtonSize = 'lg';
  @Input() color: UiButtonColor = 'primary';

  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() full = false;
  @Input() disabled = false;
  @Input() loading = false;
  @Input() iconOnly = false;

  get isDisabled(): boolean {
    return this.disabled || this.loading;
  }
}