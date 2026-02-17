import { Component, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { BreakpointObserver, Breakpoints, LayoutModule } from '@angular/cdk/layout';

import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
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
    MatListModule,
    MatIconModule,
    MatButtonModule,
    UiIconComponent
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss'
})

export class ShellComponent {
  private bo = inject(BreakpointObserver);
  private auth = inject(AuthService);
  private router = inject(Router);

  readonly isMobile = signal(false);
  readonly user = this.auth.user; // signal<User|null>

  constructor() {
    this.bo.observe([Breakpoints.XSmall]).subscribe(r => this.isMobile.set(r.matches));
  }

  async logout() {
    await this.auth.logout();
    await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }
}