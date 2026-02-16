import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { UiButtonComponent, UiInputComponent } from '@/app/ui';

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    UiButtonComponent,
    UiInputComponent
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})

export class LoginComponent {

  constructor() {
    this.form.valueChanges.subscribe(() => this.error.set(null));
  }

  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  async submit() {

    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);

    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.signIn(email, password);

      await this.router.navigateByUrl('/app/notes', { replaceUrl: true });

    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Ошибка входа');
    } finally {
      this.loading.set(false);
    }
  }
}