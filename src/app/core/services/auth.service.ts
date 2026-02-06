import { Injectable, inject, computed } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  User,
} from 'firebase/auth';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom, shareReplay, take } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);

  readonly user$ = authState(this.auth).pipe(
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly user = toSignal(this.user$, { initialValue: null as User | null });

  readonly uid = computed(() => this.user()?.uid ?? null);

  async signUp(email: string, password: string) {
    return createUserWithEmailAndPassword(this.auth, email, password);
  }

  async signIn(email: string, password: string) {
    await signInWithEmailAndPassword(this.auth, email, password);
    await firstValueFrom(this.user$.pipe(filter(Boolean), take(1)));
  }

  async logout() {
    return signOut(this.auth);
  }
}
