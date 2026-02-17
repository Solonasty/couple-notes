import { Component, HostBinding, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import type { AppIconName } from '@/app/core/services/icon-registry.service';

@Component({
  selector: 'ui-icon',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './ui-icon.component.html',
  styleUrl: './ui-icon.component.scss',
})
export class UiIconComponent {
  @Input({ required: true }) name!: AppIconName;
  @Input() size: 'sm' | 'md' | 'lg' = 'md';

  @HostBinding('attr.data-size')
  get dataSize() {
    return this.size;
  }
}
