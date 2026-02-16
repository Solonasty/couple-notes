import { Component, computed, effect, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

import {
  Firestore,
  doc,
  docData,
  setDoc,
  serverTimestamp,
} from '@angular/fire/firestore';

import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { of, switchMap, type Observable } from 'rxjs';
import type { DocumentReference } from 'firebase/firestore';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updateEmail,
  updatePassword,
} from 'firebase/auth';

type UserProfile = {
  email?: string;
  name?: string;
  pairId?: string | null;
  partnerUid?: string | null;
  partnerEmail?: string | null;
};

@Component({
  standalone: true,
  selector: 'app-dashboard',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private fs = inject(Firestore);

  readonly user = this.auth.user;
  readonly uid = computed(() => this.user()?.uid ?? null);

  // корректная реактивность: uid (signal) -> observable -> docData -> signal
  readonly profile = toSignal<UserProfile | null>(
    toObservable(this.uid).pipe(
      switchMap((uid) => {
        if (!uid) return of(null);

        const ref = doc(this.fs, `users/${uid}`) as unknown as DocumentReference<UserProfile>;
        return docData(ref) as unknown as Observable<UserProfile>;
      })
    ),
    { initialValue: null }
  );

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly ok = signal<string | null>(null);

  profileForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(40)]],
  });

  emailForm = this.fb.nonNullable.group({
    newEmail: ['', [Validators.required, Validators.email]],
    currentPassword: ['', [Validators.required, Validators.minLength(6)]],
  });

  passwordForm = this.fb.nonNullable.group({
    currentPassword: ['', [Validators.required, Validators.minLength(6)]],
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
  });

  constructor() {
    effect(() => {
      const p = this.profile();
      if (p?.name) {
        this.profileForm.patchValue({ name: p.name }, { emitEvent: false });
      }
    });
  }

  private async reauth(currentPassword: string) {
    const u = this.user();
    if (!u?.email) throw new Error('Нет email у пользователя');
    const cred = EmailAuthProvider.credential(u.email, currentPassword);
    await reauthenticateWithCredential(u, cred);
  }

  async saveName() {
    this.error.set(null);
    this.ok.set(null);
    if (this.profileForm.invalid) return;

    const uid = this.uid();
    if (!uid) return;

    this.saving.set(true);
    try {
      const name = this.profileForm.getRawValue().name.trim();
      const email = (this.user()?.email ?? '').toLowerCase();

      await setDoc(
        doc(this.fs, `users/${uid}`),
        {
          name,
          email,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await setDoc(
        doc(this.fs, `publicUsers/${uid}`),
        {
          name,
          email,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      this.ok.set('Имя сохранено');
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Ошибка сохранения');
    } finally {
      this.saving.set(false);
    }
  }

  async changeEmail() {
    this.error.set(null);
    this.ok.set(null);
    if (this.emailForm.invalid) return;

    const u = this.user();
    if (!u) return;

    this.saving.set(true);
    try {
      const { newEmail, currentPassword } = this.emailForm.getRawValue();
      const cleanEmail = newEmail.trim().toLowerCase();

      await this.reauth(currentPassword);
      await updateEmail(u, cleanEmail);

      const uid = u.uid;

      await setDoc(
        doc(this.fs, `users/${uid}`),
        {
          email: cleanEmail,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await setDoc(
        doc(this.fs, `publicUsers/${uid}`),
        {
          email: cleanEmail,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      this.ok.set('Email обновлён');
      this.emailForm.reset({ newEmail: '', currentPassword: '' });
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Ошибка смены email');
    } finally {
      this.saving.set(false);
    }
  }

  async changePassword() {
    this.error.set(null);
    this.ok.set(null);
    if (this.passwordForm.invalid) return;

    const u = this.user();
    if (!u) return;

    this.saving.set(true);
    try {
      const { currentPassword, newPassword } = this.passwordForm.getRawValue();
      await this.reauth(currentPassword);
      await updatePassword(u, newPassword);

      this.ok.set('Пароль обновлён');
      this.passwordForm.reset({ currentPassword: '', newPassword: '' });
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Ошибка смены пароля');
    } finally {
      this.saving.set(false);
    }
  }
}
