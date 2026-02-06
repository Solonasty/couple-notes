import { Component, computed, effect, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';

import { Firestore, doc, docData, setDoc, serverTimestamp, collection, collectionData, query, where } from '@angular/fire/firestore';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';

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
import { Observable, of, startWith, switchMap } from 'rxjs';
import { PairService } from '../../core/services/pair.service';


type PairInvite = {
  pairId: string;
  fromUid: string;
  toUid: string;
  fromEmail: string;
  toEmail: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt?: unknown;
  acceptedAt?: unknown;
};

type UserProfile = {
  email?: string;
  name?: string;
  pairId?: string | null;
};


type PairInviteDoc = PairInvite & { id: string };



@Component({
  standalone: true,
  selector: 'app-dashboard',
  imports: [ReactiveFormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private fs = inject(Firestore);
  private pair = inject(PairService);
  private router = inject(Router);

  readonly user = this.auth.user; // signal<User|null>
  readonly uid = computed(() => this.user()?.uid ?? null);

  readonly profile = toSignal<UserProfile | null>(
    computed(() => {
      const uid = this.uid();
      if (!uid) return null;
      return docData(doc(this.fs, `users/${uid}`)) as any;
    })() as any,
    { initialValue: null }
  );

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly ok = signal<string | null>(null);

  // профиль (name хранится в Firestore)
  profileForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(40)]],
  });

  // смена email (в Auth) — требует currentPassword для reauth
  emailForm = this.fb.nonNullable.group({
    newEmail: ['', [Validators.required, Validators.email]],
    currentPassword: ['', [Validators.required, Validators.minLength(6)]],
  });

  // смена пароля (в Auth) — требует currentPassword для reauth
  passwordForm = this.fb.nonNullable.group({
    currentPassword: ['', [Validators.required, Validators.minLength(6)]],
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
  });

  // добавить пару по email
  pairForm = this.fb.nonNullable.group({
    partnerEmail: ['', [Validators.required, Validators.email]],
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

      await setDoc(doc(this.fs, `users/${uid}`), {
        name,
        email: (this.user()?.email ?? '').toLowerCase(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      // обновляем publicUsers (для поиска пары)
      await setDoc(doc(this.fs, `publicUsers/${uid}`), {
        name,
        email: (this.user()?.email ?? '').toLowerCase(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

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
      await this.reauth(currentPassword);
      await updateEmail(u, newEmail.trim().toLowerCase());

      // синхронизируем Firestore
      const uid = u.uid;
      await setDoc(doc(this.fs, `users/${uid}`), {
        email: (u.email ?? newEmail).toLowerCase(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      await setDoc(doc(this.fs, `publicUsers/${uid}`), {
        email: (u.email ?? newEmail).toLowerCase(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

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

  async addPair() {
    this.error.set(null);
    this.ok.set(null);
    if (this.pairForm.invalid) return;

    this.saving.set(true);
    try {
      const { partnerEmail } = this.pairForm.getRawValue();
      await this.pair.createPairByEmail(partnerEmail);
      this.ok.set('Пара создана');
      await this.router.navigateByUrl('/app/notes', { replaceUrl: true });
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Ошибка создания пары');
    } finally {
      this.saving.set(false);
    }
  }

  async acceptInvite(inviteId: string) {
    this.error.set(null);
    this.ok.set(null);
  
    this.saving.set(true);
    try {
      await this.pair.acceptInvite(inviteId);
      this.ok.set('Пара создана ✅');
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Ошибка принятия');
    } finally {
      this.saving.set(false);
    }
  }
  
  async declineInvite(inviteId: string) {
    this.error.set(null);
    this.ok.set(null);
  
    this.saving.set(true);
    try {
      await this.pair.declineInvite(inviteId);
      this.ok.set('Приглашение отклонено');
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Ошибка отклонения');
    } finally {
      this.saving.set(false);
    }
  }


  readonly incomingInvites = toSignal<PairInviteDoc[]>(
    (toObservable(this.uid) as Observable<string | null>).pipe(
      switchMap((uid): Observable<PairInviteDoc[]> => {
        if (!uid) return of([] as PairInviteDoc[]);
  
        const colRef = collection(this.fs, 'pairInvites');
        const q = query(
          colRef,
          where('toUid', '==', uid),
          where('status', '==', 'pending')
        );
  
        return (collectionData(q, { idField: 'id' }) as unknown as Observable<PairInviteDoc[]>)
          .pipe(startWith([] as PairInviteDoc[]));
      }),
      startWith([] as PairInviteDoc[])
    ),
    { requireSync: true }
  );

  readonly myAcceptedOutgoing = toSignal<PairInviteDoc[]>(
    (toObservable(this.uid) as Observable<string | null>).pipe(
      switchMap((uid): Observable<PairInviteDoc[]> => {
        if (!uid) return of([] as PairInviteDoc[]);
  
        const colRef = collection(this.fs, 'pairInvites');
        const q = query(
          colRef,
          where('fromUid', '==', uid),
          where('status', '==', 'accepted')
        );
  
        return (collectionData(q, { idField: 'id' }) as unknown as Observable<PairInviteDoc[]>)
          .pipe(startWith([] as PairInviteDoc[]));
      }),
      startWith([] as PairInviteDoc[])
    ),
    { requireSync: true }
  );
  
}
