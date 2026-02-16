import { Injectable, inject } from '@angular/core';
import { Firestore, doc, docData } from '@angular/fire/firestore';
import { updateDoc, serverTimestamp, type DocumentReference, type FieldValue } from 'firebase/firestore';
import {
  EMPTY,
  Observable,
  combineLatest,
  from,
  switchMap,
  map,
  distinctUntilChanged,
  take,
} from 'rxjs';
import { AuthService } from './auth.service';
import { PairContextService } from './pair-context.service';
import { UserProfile } from './pair.types';

type PublicUser = {
  email?: string | null;
};

type UserDocPatch = {
  pairId: string | null;
  partnerUid: string | null;
  partnerEmail: string | null;
  updatedAt: FieldValue;
};

@Injectable({ providedIn: 'root' })
export class PairProfileSyncService {
  private fs = inject(Firestore);
  private auth = inject(AuthService);
  private pairCtx = inject(PairContextService);

  init() {
    return this.auth.user$.pipe(
      switchMap((user) => {
        if (!user) return EMPTY;

        const myRef = doc(this.fs, `users/${user.uid}`) as unknown as DocumentReference<UserProfile>;
        const myProfile$ = docData(myRef) as unknown as Observable<UserProfile>;

        return combineLatest({
          profile: myProfile$,
          activePair: this.pairCtx.activePair$,
        }).pipe(
          map(({ profile, activePair }) => ({ user, profile, activePair })),

          distinctUntilChanged((a, b) => {
            const aPair = a.activePair?.id ?? null;
            const bPair = b.activePair?.id ?? null;
            return (
              (a.profile?.pairId ?? null) === (b.profile?.pairId ?? null) &&
              (a.profile?.partnerUid ?? null) === (b.profile?.partnerUid ?? null) &&
              aPair === bPair
            );
          }),

          switchMap(({ user, profile, activePair }) => {
            const currentPairId = profile?.pairId ?? null;

            // нет активной пары
            if (!activePair) {
              if (!currentPairId) return EMPTY;

              const patch: UserDocPatch = {
                pairId: null,
                partnerUid: null,
                partnerEmail: null,
                updatedAt: serverTimestamp(),
              };

              return from(updateDoc(myRef, patch));
            }

            // активная пара есть
            const nextPairId = activePair.id;

            const members = Array.isArray(activePair.members) ? activePair.members : [];
            const partnerUid = members.find((m) => m !== user.uid) ?? null;

            const needUpdate =
              currentPairId !== nextPairId ||
              (profile?.partnerUid ?? null) !== partnerUid;

            if (!needUpdate) return EMPTY;

            // если партнёр ещё не определён — просто пишем pairId, а партнёрские поля очищаем
            if (!partnerUid) {
              const patch: UserDocPatch = {
                pairId: nextPairId,
                partnerUid: null,
                partnerEmail: null,
                updatedAt: serverTimestamp(),
              };

              return from(updateDoc(myRef, patch));
            }

            // берём email партнёра из publicUsers/{uid}
            const partnerPublicRef = doc(
              this.fs,
              `publicUsers/${partnerUid}`
            ) as unknown as DocumentReference<PublicUser>;

            const partnerPublic$ = docData(partnerPublicRef) as unknown as Observable<PublicUser>;

            return partnerPublic$.pipe(
              take(1),
              switchMap((partnerPublic) => {
                const patch: UserDocPatch = {
                  pairId: nextPairId,
                  partnerUid,
                  partnerEmail: partnerPublic.email ?? null,
                  updatedAt: serverTimestamp(),
                };

                return from(updateDoc(myRef, patch));
              })
            );
          })
        );
      })
    );
  }
}
