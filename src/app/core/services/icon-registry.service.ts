import { Injectable, inject } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';

export const APP_ICONS = ['cabinet', 'notes', 'couples', 'logout', 'report', 'add'] as const;
export type AppIconName = (typeof APP_ICONS)[number];

@Injectable({ providedIn: 'root' })
export class IconRegistryService {
  private readonly icons = inject(MatIconRegistry);
  private readonly sanitizer = inject(DomSanitizer);

  private readonly base = 'assets/icons';

  register(): void {
    APP_ICONS.forEach((name) => {
      this.icons.addSvgIcon(
        name,
        this.sanitizer.bypassSecurityTrustResourceUrl(`${this.base}/${name}.svg`)
      );
    });
  }
}
