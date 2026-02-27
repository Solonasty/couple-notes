import { Routes } from '@angular/router';
import { ShellComponent } from './core/layout/shell.component';
import { authGuard } from './core/services/auth.guard';


export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'app' },

  {
    path: 'auth',
    children: [
      { path: 'login', loadComponent: () => import('./features/login/login.component').then(m => m.LoginComponent) },
      { path: 'register', loadComponent: () => import('./features/register/register.component').then(m => m.RegisterComponent) },
    ],
  },

  {
    path: 'app',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'notes' },
      { path: 'notes', loadComponent: () => import('./features/notes/notes.component').then(m => m.NotesComponent) },
      { path: 'weekly', loadComponent: () => import('./features/weekly/weekly.component').then(m => m.WeeklyComponent) },
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'pair', loadComponent: () => import('./features/pair/pair.component').then(m => m.PairComponent) },
      { path: 'ui-kit', loadComponent: () => import('./features/ui-kit/ui-kit.component').then(m => m.UIKitComponent) },

    ],
  },

  { path: '**', redirectTo: '' },
];