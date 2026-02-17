import { Injectable } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';

export const APP_ICONS = ['cabinet', 'notes', 'couples', 'logout', 'report'] as const;
export type AppIconName = (typeof APP_ICONS)[number];

@Injectable({ providedIn: 'root' })
export class IconRegistryService {
  private readonly base = 'assets/icons';

  constructor(
    private readonly icons: MatIconRegistry,
    private readonly sanitizer: DomSanitizer,
  ) {}

  register(): void {
    APP_ICONS.forEach(name => {
      this.icons.addSvgIcon(name, this.sanitizer.bypassSecurityTrustResourceUrl(`${this.base}/${name}.svg`));
    });
  }
}
