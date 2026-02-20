import { Component, computed, effect, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Firestore, collection, collectionData, query, where } from '@angular/fire/firestore';
import { toObservable, toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, of, switchMap, startWith } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { PairService } from '../../core/services/pair.service';
import { PairInvite, UserProfile } from '../../core/services/pair.types';

import { doc, docData } from '@angular/fire/firestore';
import { map } from 'rxjs/operators';

import { UiButtonComponent, UiInputComponent } from '@/app/ui';

type PairInviteDoc = PairInvite & { id: string };

@Component({
  standalone: true,
  selector: 'app-pair',
  imports: [
    ReactiveFormsModule,
    UiButtonComponent,
    UiInputComponent,
  ],
  templateUrl: './pair.component.html',
  styleUrl: './pair.component.scss',
})
export class PairComponent {
  private fb = inject(FormBuilder);
  private fs = inject(Firestore);
  private auth = inject(AuthService);
  private pair = inject(PairService);
  private checkedPairId: string | null = null;

  private processed = new Set<string>();
  private lastUid: string | null = null;

  readonly user = this.auth.user;
  readonly uid = computed(() => this.user()?.uid ?? null);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly ok = signal<string | null>(null);

  readonly incomingInvites = this.invitesSignal('toUid', 'pending');
  readonly outgoingInvites = this.invitesSignal('fromUid', 'pending');
  readonly acceptedSentInvites = this.invitesSignal('fromUid', 'accepted');

  readonly myProfile = toSignal<UserProfile | null>(
    (toObservable(this.uid) as Observable<string | null>).pipe(
      switchMap((uid) => {
        if (!uid) return of(null);
        const ref = doc(this.fs, `users/${uid}`);
        return (docData(ref) as Observable<UserProfile>).pipe(map((p) => p ?? null));
      })
    ),
    { initialValue: null }
  );

  readonly canShowInviteForm = computed(() => {
    if (this.myProfile()?.pairId) return false;
    if (this.outgoingInvites().length > 0) return false;
    if (this.incomingInvites().length > 0) return false;
    return true;
  });

  pairForm = this.fb.nonNullable.group({
    partnerEmail: ['', [Validators.required, Validators.email]],
  });

  constructor() {
    effect(() => {
      const uid = this.uid();
      if (uid !== this.lastUid) {
        this.processed.clear();
        this.lastUid = uid;
      }
      if (!uid) return;

      for (const inv of this.acceptedSentInvites()) {
        if (this.processed.has(inv.id)) continue;
        this.processed.add(inv.id);

        void this.pair.attachAcceptedInviteAsSender(inv.id).catch((e) => {
          this.error.set(e instanceof Error ? e.message : 'Ошибка синхронизации пары');
        });
      }
    });

    effect(() => {
      const uid = this.uid();
      const pairId = this.myProfile()?.pairId ?? null;

      if (!uid || !pairId) {
        this.checkedPairId = null;
        return;
      }

      if (this.checkedPairId === pairId) return;
      this.checkedPairId = pairId;

      void this.pair.syncEndedPairOnOpen(pairId).catch((e) => {
        this.error.set(e instanceof Error ? e.message : 'Ошибка синхронизации пары');
      });
    });

    // Как в dashboard — очищаем сообщения при изменении формы
    this.pairForm.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.error.set(null);
        this.ok.set(null);
      });
  }

  private invitesSignal(field: 'toUid' | 'fromUid', status: PairInvite['status']) {
    const s = toSignal<PairInviteDoc[]>(
      (toObservable(this.uid) as Observable<string | null>).pipe(
        switchMap((uid) => {
          if (!uid) return of([] as PairInviteDoc[]);
          const colRef = collection(this.fs, 'pairInvites');
          const q = query(colRef, where(field, '==', uid), where('status', '==', status));
          return collectionData(q, { idField: 'id' }) as Observable<PairInviteDoc[]>;
        }),
        startWith([] as PairInviteDoc[])
      ),
      { requireSync: true }
    );
    return computed(() => s() ?? []);
  }

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

  async breakPair() {
    this.error.set(null);
    this.ok.set(null);

    this.saving.set(true);
    try {
      await this.pair.breakPair();
      this.ok.set('Пара разорвана');
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Ошибка разрыва пары');
    } finally {
      this.saving.set(false);
    }
  }
}