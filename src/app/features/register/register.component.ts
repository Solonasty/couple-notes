import { Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { Firestore, doc, setDoc, serverTimestamp } from '@angular/fire/firestore';
import { UiButtonComponent, UiInputComponent } from '@/app/ui';

@Component({
  standalone: true,
  selector: 'app-register',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    UiButtonComponent,
    UiInputComponent,
  ],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {

  constructor() {
    this.form.valueChanges.subscribe(() => this.error.set(null));
  }

  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private fs = inject(Firestore);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(40)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  async submit() {
    if (this.form.invalid) return;

    this.loading.set(true);
    this.error.set(null);

    try {
      const { name, email, password } = this.form.getRawValue();

      const cred = await this.auth.signUp(email.trim().toLowerCase(), password);
      const uid = cred.user.uid;

      const cleanName = name.trim();
      const cleanEmail = email.trim().toLowerCase();

      await setDoc(
        doc(this.fs, `users/${uid}`),
        {
          name: cleanName,
          email: cleanEmail,
          pairId: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await setDoc(
        doc(this.fs, `publicUsers/${uid}`),
        {
          name: cleanName,
          email: cleanEmail,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await this.router.navigateByUrl('/app/notes', { replaceUrl: true });
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Ошибка регистрации');
    } finally {
      this.loading.set(false);
    }
  }
}
