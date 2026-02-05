import { Routes } from '@angular/router';
import { ShellComponent } from './core/layout/shell.component';
import { authGuard } from './core/services/auth.guard';


export const routes: Routes = [
  // Главная всегда ведёт в приложение
  { path: '', pathMatch: 'full', redirectTo: 'app' },

  // Авторизация (доступна всем)
  {
    path: 'auth',
    children: [
      { path: 'login', loadComponent: () => import('./features/login/login.component').then(m => m.LoginComponent) },
      { path: 'register', loadComponent: () => import('./features/register/register.component').then(m => m.RegisterComponent) },
    ],
  },

  // Приложение (только для залогиненных)
  {
    path: 'app',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'notes' },
      { path: 'notes', loadComponent: () => import('./features/notes/notes.component').then(m => m.NotesComponent) },
      { path: 'weekly', loadComponent: () => import('./features/weekly/weekly.component').then(m => m.WeeklyComponent) },
    ],
  },

  // всё остальное на главную
  { path: '**', redirectTo: '' },
];