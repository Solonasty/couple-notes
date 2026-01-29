import { Routes } from '@angular/router';
import { ShellComponent } from './core/layout/shell.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'auth/login' },

  {
    path: 'auth',
    children: [
      { path: 'login', loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent) },
      { path: 'register', loadComponent: () => import('./features/auth/register.component').then(m => m.RegisterComponent) },
    ],
  },

  {
    path: 'app',
    component: ShellComponent,
    children: [
      { path: '', loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'notes', loadComponent: () => import('./features/notes/notes.component').then(m => m.NotesComponent) },
      { path: 'weekly', loadComponent: () => import('./features/weekly/weekly.component').then(m => m.WeeklyComponent) }
    ],
  },

  { path: '**', redirectTo: 'app' },
];
