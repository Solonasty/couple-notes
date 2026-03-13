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
  of,
  filter,
  firstValueFrom,
} from 'rxjs';
import { AuthService } from '../guards/auth.service';
import { PairContextService } from './pair-context.service';
import { User } from '../models/user.type';

@Injectable({ providedIn: 'root' })
export class PairProfileSyncService {
  private fs = inject(Firestore);
  private auth = inject(AuthService);
  private pairCtx = inject(PairContextService);

  bootstrap(): Promise<void> {
    return firstValueFrom(
      this.auth.user$.pipe(
        take(1),
        switchMap((user) => {
          if (!user) return of(null);

          const myRef = doc(this.fs, `users/${user.uid}`) as unknown as DocumentReference<User>;
          const myProfile$ = docData(myRef).pipe(
            filter((profile): profile is User => profile != null),
            take(1)
          );
          const activePair$ = this.pairCtx.activePair$.pipe(take(1));

          return combineLatest({
            profile: myProfile$,
            activePair: activePair$,
          }).pipe(
            switchMap(({ profile, activePair }) =>
              this.syncOnce(user.uid, myRef, profile, activePair)
            ),
            take(1)
          );
        })
      )
    ).then(() => undefined);
  }

  private syncOnce(
    currentUid: string,
    myRef: DocumentReference<User>,
    profile: User | undefined,
    activePair: any
  ) {
    const currentPairId = profile?.pairId ?? null;

    // активной пары нет
    if (!activePair) {
      if (!currentPairId) return of(null);

      const patch: Partial<User> = {
        pairId: null,
        partnerUid: null,
        partnerEmail: null,
        updatedAt: serverTimestamp() as any,
      };

      return from(updateDoc(myRef, patch));
    }

    const nextPairId = activePair.id;
    const members = Array.isArray(activePair.members)
      ? (activePair.members as string[])
      : [];

    const partnerUid = members.find((m) => m !== currentUid) ?? null;
    const needUpdate =
      currentPairId !== nextPairId ||
      (profile?.partnerUid ?? null) !== partnerUid;

    if (!needUpdate) return of(null);

    // пара есть, но второй участник ещё не определён
    if (!partnerUid) {
      const patch: Partial<User> = {
        pairId: nextPairId,
        partnerUid: null,
        partnerEmail: null,
        updatedAt: serverTimestamp() as any,
      };

      return from(updateDoc(myRef, patch));
    }

    const partnerPublicRef = doc(
      this.fs,
      `publicUsers/${partnerUid}`
    ) as unknown as DocumentReference<User>;

    const partnerPublic$ = docData(partnerPublicRef).pipe(
      filter((partnerPublic): partnerPublic is User => partnerPublic != null),
      take(1)
    );

    return partnerPublic$.pipe(
      switchMap((partnerPublic) => {
        const patch: Partial<User> = {
          pairId: nextPairId,
          partnerUid,
          partnerEmail: partnerPublic?.email ?? null,
          updatedAt: serverTimestamp() as any,
        };

        return from(updateDoc(myRef, patch));
      })
    );
  }

init() {
  return this.auth.user$.pipe(
    switchMap((user) => {
      if (!user) return EMPTY;

      const myRef = doc(this.fs, `users/${user.uid}`) as unknown as DocumentReference<User>;
      const myProfile$ = docData(myRef) as Observable<User | undefined>;

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

        switchMap(({ user, profile, activePair }) =>
          this.syncOnce(user.uid, myRef, profile, activePair)
        )
      );
    })
  );
}
}
