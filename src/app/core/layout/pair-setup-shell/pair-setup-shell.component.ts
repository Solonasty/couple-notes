import { Component, effect, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { BreakpointObserver, Breakpoints, LayoutModule } from '@angular/cdk/layout';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { UiIconComponent } from '@/app/ui';
import { AuthService } from '../../guards/auth.service';
import { MatSidenavModule } from '@angular/material/sidenav';

@Component({
  standalone: true,
  selector: 'app-pair-setup-shell',
  imports: [
    RouterOutlet,
    LayoutModule,
    MatToolbarModule,
    MatButtonModule,
    MatSidenavModule,
    UiIconComponent,
  ],
  templateUrl: './pair-setup-shell.component.html',
  styleUrl: './pair-setup-shell.component.scss',
})
export class PairSetupShellComponent {
  private bo = inject(BreakpointObserver);
  private auth = inject(AuthService);
  private router = inject(Router);

  readonly isMobile = signal(false);
  readonly user = this.auth.user;
  readonly profile = this.auth.profile;

  constructor() {
    this.bo.observe([Breakpoints.XSmall]).subscribe(r => this.isMobile.set(r.matches));

    effect(() => {
      const p = this.profile();
      if (p?.pairId) {
        void this.router.navigateByUrl('/app', { replaceUrl: true });
      }
    });
  }

  accountName(): string {
    return this.auth.profile()?.name?.trim() || 'Couple Notes';
  }

  initials(): string {
    const name = this.accountName().trim();
    const parts = name.split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] ?? 'C';
    const b = parts[1]?.[0] ?? (parts[0]?.[1] ?? 'N');
    return (a + b).toUpperCase();
  }

  async logout() {
    await this.auth.logout();
    await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }
}
