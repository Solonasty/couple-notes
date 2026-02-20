import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { BreakpointObserver, Breakpoints, LayoutModule } from '@angular/cdk/layout';

import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';

import { AuthService } from '../services/auth.service';
import { UiIconComponent } from '@/app/ui';

@Component({
  standalone: true,
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    LayoutModule,
    MatSidenavModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    UiIconComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  private bo = inject(BreakpointObserver);
  private auth = inject(AuthService);
  private router = inject(Router);

  readonly isMobile = signal(false);
  readonly user = this.auth.user;
  readonly profile = this.auth.profile;

  constructor() {
    this.bo.observe([Breakpoints.XSmall]).subscribe(r => this.isMobile.set(r.matches));
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
