import { Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../core/services/auth.service';
import { Firestore, doc, setDoc, serverTimestamp } from '@angular/fire/firestore';


@Component({
  standalone: true,
  selector: 'app-register',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private fs = inject(Firestore);


  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(40)]],
  });

  async submit() {

    if (this.form.invalid) return;

    this.loading.set(true);
    this.error.set(null);

    try {
      const { name, email, password } = this.form.getRawValue();

      const cred = await this.auth.signUp(email, password);
      const uid = cred.user.uid;
      
      await setDoc(
        doc(this.fs, `users/${uid}`),
        {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          pairId: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      
      await setDoc(
        doc(this.fs, `publicUsers/${uid}`),
        {
          name: name.trim(),
          email: email.trim().toLowerCase(),
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
