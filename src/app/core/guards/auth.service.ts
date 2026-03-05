import { Injectable, inject, computed } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  type User as AuthUser,
} from 'firebase/auth';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom, of, shareReplay, switchMap, take } from 'rxjs';
import { Firestore, doc, docData, DocumentReference } from '@angular/fire/firestore';
import { User } from '../models/user.type';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);
  private fs = inject(Firestore);

  readonly user$ = authState(this.auth).pipe(
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly user = toSignal<AuthUser | null>(this.user$, { initialValue: null });
  readonly uid = computed(() => this.user()?.uid ?? null);

  readonly profile$ = this.user$.pipe(
    switchMap((u) => {
      if (!u) return of(null);

      const ref = doc(this.fs, `users/${u.uid}`) as DocumentReference<User>;
      return docData(ref);
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly profile = toSignal(this.profile$, {
    initialValue: null as User | null,
  });

  async signUp(email: string, password: string) {
    try {
      return await createUserWithEmailAndPassword(this.auth, email, password);
    } catch (e: unknown) {
      throw new Error(mapFirebaseAuthError(e, 'signup'));
    }
  }

  async signIn(email: string, password: string) {
    try {
      await signInWithEmailAndPassword(this.auth, email, password);
      await firstValueFrom(this.user$.pipe(filter(Boolean), take(1)));
    } catch (e: unknown) {
      throw new Error(mapFirebaseAuthError(e, 'signin'));
    }
  }

  async logout() {
    return signOut(this.auth);
  }
}

type AuthAction = 'signin' | 'signup';

type FirebaseAuthErrorLike = {
  code: string;
  message?: string;
};

function isFirebaseAuthErrorLike(e: unknown): e is FirebaseAuthErrorLike {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    typeof (e as Record<string, unknown>)['code'] === 'string'
  );
}

function getAuthErrorCode(e: unknown): string | undefined {
  return isFirebaseAuthErrorLike(e) ? e.code : undefined;
}

function mapFirebaseAuthError(e: unknown, action: AuthAction): string {
  const code = getAuthErrorCode(e);

  switch (code) {
    // sign in
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Неверный email или пароль';

    case 'auth/user-not-found':
      return 'Пользователь с таким email не найден';

    // common
    case 'auth/invalid-email':
      return 'Введите корректный email';

    case 'auth/user-disabled':
      return 'Аккаунт отключён. Обратитесь в поддержку';

    case 'auth/too-many-requests':
      return 'Слишком много попыток. Попробуйте позже';

    case 'auth/network-request-failed':
      return 'Проблема с сетью. Проверьте интернет';

    // sign up
    case 'auth/email-already-in-use':
      return 'Этот email уже зарегистрирован';

    case 'auth/weak-password':
      return 'Пароль слишком простой. Используйте минимум 6 символов';

    default:
      return action === 'signup'
        ? 'Не удалось зарегистрироваться. Попробуйте ещё раз'
        : 'Не удалось войти. Попробуйте ещё раз';
  }
}