import { Routes } from '@angular/router';
import { authMatchGuard } from './core/guards/auth-match.guard';
import { hasPairGuard, noPairGuard } from './core/guards/pair.guard';
import { ShellComponent } from './core/layout/base-shell/shell.component';
import { PairSetupShellComponent } from './core/layout/pair-setup-shell/pair-setup-shell.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'app' },

  {
    path: 'auth',
    children: [
      { path: 'login', loadComponent: () => import('./features/login/login.component').then(m => m.LoginComponent) },
      { path: 'register', loadComponent: () => import('./features/register/register.component').then(m => m.RegisterComponent) },
    ],
  },

  // Ветка "есть пара"
  {
    path: 'app',
    canMatch: [authMatchGuard, hasPairGuard],
    component: ShellComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'about' },
      { path: 'about', loadComponent: () => import('./features/about/about.component').then(m => m.AboutComponent) },
      { path: 'notes', loadComponent: () => import('./features/notes/notes.component').then(m => m.NotesComponent) },
      { path: 'weekly', loadComponent: () => import('./features/weekly/weekly.component').then(m => m.WeeklyComponent) },
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'pair', loadComponent: () => import('./features/pair/pair.component').then(m => m.PairComponent) },
      { path: '**', redirectTo: 'notes' },
    ],
  },

  // Ветка "нет пары"
  {
    path: 'app',
    canMatch: [authMatchGuard, noPairGuard],
    component: PairSetupShellComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'pair-setup' },
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'pair-setup', loadComponent: () => import('./features/pair-setup/pair-start/pair-start.component').then(m => m.PairStartComponent) },
      { path: 'pair-setup/invite', loadComponent: () => import('./features/pair-setup/pair-invite/pair-invite.component').then(m => m.PairInviteComponent) },
      { path: 'pair-setup/join', loadComponent: () => import('./features/pair-setup/pair-join/pair-join.component').then(m => m.PairJoinComponent) },
      { path: 'pair-setup/waiting', loadComponent: () => import('./features/pair-setup/pair-waiting/pair-waiting.component').then(m => m.PairWaitingComponent) },
      { path: '**', redirectTo: 'pair-setup' },
    ],
  },

  { path: '**', redirectTo: '' },
];