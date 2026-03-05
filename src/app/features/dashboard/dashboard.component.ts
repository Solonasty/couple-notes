import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/guards/auth.service';
import { Firestore, doc, setDoc, serverTimestamp } from '@angular/fire/firestore';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import { UiButtonComponent, UiInputComponent } from '@/app/ui';

@Component({
  standalone: true,
  selector: 'app-dashboard',
  imports: [
    ReactiveFormsModule,
    UiButtonComponent,
    UiInputComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private fs = inject(Firestore);

  readonly user = this.auth.user;
  readonly uid = this.auth.uid;
  readonly profile = this.auth.profile;

  readonly savingName = signal(false);
  readonly savingPassword = signal(false);
  readonly error = signal<string | null>(null);
  readonly ok = signal<string | null>(null);

  readonly accountEmail = computed(() => {
    return this.user()?.email ?? this.profile()?.email ?? '—';
  });

  readonly greetingTitle = computed(() => {
    const name = this.profile()?.name?.trim();

    if (!name) return 'Привет 👋';
    const firstName = name.split(/\s+/)[0];
    return `Привет, ${firstName}`;
  });

  nameForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(40)]],
  });

  passwordForm = this.fb.nonNullable.group({
    currentPassword: ['', [Validators.required, Validators.minLength(6)]],
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
  });

  constructor() {
    effect(() => {
      const name = this.profile()?.name?.trim() ?? '';
      if (!name) return;

      if (this.nameForm.controls.name.value !== name) {
        this.nameForm.patchValue({ name }, { emitEvent: false });
      }
    });

    this.nameForm.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.error.set(null);
        this.ok.set(null);
      });

    this.passwordForm.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.error.set(null);
        this.ok.set(null);
      });
  }

  private async reauth(currentPassword: string) {
    const u = this.user();
    if (!u?.email) throw new Error('Не удалось определить email пользователя');

    const cred = EmailAuthProvider.credential(u.email, currentPassword);
    await reauthenticateWithCredential(u, cred);
  }

  async saveName() {
    if (this.nameForm.invalid) return;

    const uid = this.uid();
    if (!uid) return;

    this.savingName.set(true);
    this.error.set(null);
    this.ok.set(null);

    try {
      const name = this.nameForm.getRawValue().name.trim();
      const email = (this.user()?.email ?? this.profile()?.email ?? '').trim().toLowerCase();

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

      this.ok.set('Имя обновлено');
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? mapProfileError(e) : 'Ошибка сохранения имени');
    } finally {
      this.savingName.set(false);
    }
  }

  async changePassword() {
    if (this.passwordForm.invalid) return;

    const u = this.user();
    if (!u) return;

    this.savingPassword.set(true);
    this.error.set(null);
    this.ok.set(null);

    try {
      const { currentPassword, newPassword } = this.passwordForm.getRawValue();

      await this.reauth(currentPassword);
      await updatePassword(u, newPassword);

      this.passwordForm.reset({
        currentPassword: '',
        newPassword: '',
      });

      this.ok.set('Пароль обновлён');
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? mapProfileError(e) : 'Ошибка смены пароля');
    } finally {
      this.savingPassword.set(false);
    }
  }
}

type FirebaseAuthErrorLike = { code?: string; message?: string };

function mapProfileError(e: unknown): string {
  const code = (e as FirebaseAuthErrorLike)?.code;

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Неверный текущий пароль';

    case 'auth/weak-password':
      return 'Новый пароль слишком простой (минимум 6 символов)';

    case 'auth/requires-recent-login':
      return 'Для этого действия нужно войти заново';

    case 'auth/too-many-requests':
      return 'Слишком много попыток. Попробуйте позже';

    case 'auth/network-request-failed':
      return 'Проблема с сетью. Проверьте интернет';

    default:
      return (e as Error)?.message || 'Что-то пошло не так';
  }
}