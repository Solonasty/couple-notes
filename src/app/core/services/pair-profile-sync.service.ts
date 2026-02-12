import { Injectable, inject } from '@angular/core';
import { Firestore, doc, docData } from '@angular/fire/firestore';
import { updateDoc, serverTimestamp } from 'firebase/firestore';
import {
  EMPTY,
  combineLatest,
  from,
  switchMap,
  map,
  filter,
  distinctUntilChanged,
  take,
} from 'rxjs';
import { AuthService } from './auth.service';
import { PairContextService } from './pair-context.service';
import { UserProfile } from './pair.types';

@Injectable({ providedIn: 'root' })
export class PairProfileSyncService {
  private fs = inject(Firestore);
  private auth = inject(AuthService);
  private pairCtx = inject(PairContextService);

  init() {
    return this.auth.user$.pipe(
      switchMap(user => {
        if (!user) return EMPTY;

        const myRef = doc(this.fs, `users/${user.uid}`);
        const myProfile$ = docData(myRef) as unknown as import('rxjs').Observable<UserProfile>;

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
              return from(updateDoc(myRef, {
                pairId: null,
                partnerUid: null,
                partnerEmail: null,
                updatedAt: serverTimestamp(),
              }));
            }

            // активная пара есть
            const nextPairId = activePair.id;
            const partnerUid =
              (activePair.members || []).find((m: string) => m !== user.uid) ?? null;

            const needUpdate =
              currentPairId !== nextPairId ||
              (profile?.partnerUid ?? null) !== partnerUid;

            if (!needUpdate) return EMPTY;

            if (!partnerUid) {
              return from(updateDoc(myRef, {
                pairId: nextPairId,
                partnerUid: null,
                partnerEmail: null,
                updatedAt: serverTimestamp(),
              }));
            }

            const partnerPublicRef = doc(this.fs, `publicUsers/${partnerUid}`);
            return (docData(partnerPublicRef) as any).pipe(
              take(1),
              switchMap((partnerPublic: any) =>
                from(updateDoc(myRef, {
                  pairId: nextPairId,
                  partnerUid,
                  partnerEmail: partnerPublic?.email ?? null,
                  updatedAt: serverTimestamp(),
                }))
              )
            );
          })
        );
      })
    );
  }
}
