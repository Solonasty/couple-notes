import { Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Firestore, collection, collectionData, query, where } from '@angular/fire/firestore';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Observable, of, switchMap, startWith } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
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

type PairInviteDoc = PairInvite & { id: string };

@Component({
  standalone: true,
  selector: 'app-pair',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  templateUrl: './pair.component.html',
})
export class PairComponent {
  private fb = inject(FormBuilder);
  private fs = inject(Firestore);
  private auth = inject(AuthService);
  private pair = inject(PairService);

  readonly user = this.auth.user;
  readonly uid = computed(() => this.user()?.uid ?? null);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly ok = signal<string | null>(null);

  pairForm = this.fb.nonNullable.group({
    partnerEmail: ['', [Validators.required, Validators.email]],
  });

  readonly incomingInvites = toSignal<PairInviteDoc[]>(
    (toObservable(this.uid) as Observable<string | null>).pipe(
      switchMap((uid): Observable<PairInviteDoc[]> => {
        if (!uid) return of([] as PairInviteDoc[]);
        const colRef = collection(this.fs, 'pairInvites');
        const q = query(colRef, where('toUid', '==', uid), where('status', '==', 'pending'));
        return (collectionData(q, { idField: 'id' }) as unknown as Observable<PairInviteDoc[]>)
          .pipe(startWith([] as PairInviteDoc[]));
      }),
      startWith([] as PairInviteDoc[])
    ),
    { requireSync: true }
  );

  async createInvite() {
    this.error.set(null);
    this.ok.set(null);
    if (this.pairForm.invalid) return;

    this.saving.set(true);
    try {
      const { partnerEmail } = this.pairForm.getRawValue();
      await this.pair.createPairByEmail(partnerEmail);
      this.ok.set('Приглашение отправлено');
      this.pairForm.reset({ partnerEmail: '' });
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Ошибка создания приглашения');
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
}
