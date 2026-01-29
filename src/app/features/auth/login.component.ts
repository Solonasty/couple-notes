import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule
  ],
  template: `
    <div class="wrap">
      <mat-card class="card">
        <mat-card-title>Вход</mat-card-title>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <mat-form-field appearance="outline" class="full">
            <mat-label>Email</mat-label>
            <input matInput formControlName="email" autocomplete="email" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="full">
            <mat-label>Пароль</mat-label>
            <input matInput type="password" formControlName="password" autocomplete="current-password" />
          </mat-form-field>

          <button mat-raised-button color="primary" class="full" [disabled]="form.invalid">
            Войти
          </button>
        </form>

        <div class="links">
          Нет аккаунта? <a routerLink="/auth/register">Регистрация</a>
        </div>
      </mat-card>
    </div>
  `,
  styles: [`
    .wrap { height: 100vh; display: grid; place-items: center; padding: 16px; }
    .card { width: 100%; max-width: 420px; }
    .full { width: 100%; }
    .links { margin-top: 12px; opacity: .85; }
  `]
})
export class LoginComponent {
  form = new FormBuilder().nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  submit() {
    // позже подключим Supabase auth
    console.log(this.form.getRawValue());
  }
}
