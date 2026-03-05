import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
} from '@angular/fire/firestore';
import type {
  DocumentReference,
  WithFieldValue,
} from 'firebase/firestore';
import { AuthService } from '../guards/auth.service';
import { User } from '../models/user.type';
import { Pair } from '../models/pair.type';

@Injectable({ providedIn: 'root' })
export class PairService {
  private fs = inject(Firestore);
  private auth = inject(AuthService);

  async breakPair(): Promise<void> {
    const me = this.auth.user();
    if (!me) throw new Error('Вы не авторизованы');

    const myRef = doc(this.fs, `users/${me.uid}`) as unknown as DocumentReference<User>;

    const clearPatch = {
      pairId: null,
      partnerUid: null,
      partnerEmail: null,
      updatedAt: serverTimestamp(),
    } satisfies WithFieldValue<User>;

    await runTransaction(this.fs, async (tx) => {
      const mySnap = await tx.get(myRef);
      if (!mySnap.exists()) throw new Error('Ваш профиль users/{uid} не найден');

      const pairId = mySnap.data()?.pairId ?? null;
      if (!pairId) throw new Error('Вы не состоите в паре');

      const pairRef = doc(this.fs, `pairs/${pairId}`) as unknown as DocumentReference<Pair>;
      const pairSnap = await tx.get(pairRef);

      if (pairSnap.exists()) {
        const pair = pairSnap.data();
        const members = Array.isArray(pair?.members) ? pair.members : [];
        if (!members.includes(me.uid)) throw new Error('Нет доступа к этой паре');

        tx.update(pairRef, {
          status: 'ended',
          endedAt: serverTimestamp(),
          endedBy: me.uid,
        });
      }

      tx.set(myRef, clearPatch, { merge: true });
    });
  }

  async syncEndedPairOnOpen(pairId: string): Promise<void> {
    const me = this.auth.user();
    if (!me) return;

    const myRef = doc(this.fs, `users/${me.uid}`) as unknown as DocumentReference<User>;
    const pairRef = doc(this.fs, `pairs/${pairId}`) as unknown as DocumentReference<Pair>;

    const pairSnap = await getDoc(pairRef);

    const shouldClear =
      !pairSnap.exists() ||
      pairSnap.data()?.status === 'ended' ||
      pairSnap.data()?.endedAt != null;

    if (!shouldClear) return;

    await setDoc(
      myRef,
      {
        pairId: null,
        partnerUid: null,
        partnerEmail: null,
        updatedAt: serverTimestamp(),
      } satisfies WithFieldValue<User>,
      { merge: true }
    );
  }
}