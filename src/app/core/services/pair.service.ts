import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from '@angular/fire/firestore';
import type {
  DocumentReference,
  WithFieldValue,
} from 'firebase/firestore';

import { AuthService } from './auth.service';
import { PairContextService } from './pair-context.service';
import { User } from '../models/user.type';
import { PairInvite } from '../models/pair-invite.type';
import { Pair } from '../models/pair.type';

@Injectable({ providedIn: 'root' })
export class PairService {
  private fs = inject(Firestore);
  private auth = inject(AuthService);
  private pairCtx = inject(PairContextService);

  // private ctx$ = combineLatest([this.auth.user$, this.pairCtx.activePair$]).pipe(
  //   map(([user, activePair]) => {
  //     if (!user) return { mode: 'none' as const };
  //     if (activePair) return { mode: 'pair' as const, uid: user.uid, pairId: activePair.id };
  //     return { mode: 'solo' as const, uid: user.uid };
  //   }),
  //   shareReplay({ bufferSize: 1, refCount: true })
  // );

  async createPairByEmail(partnerEmailRaw: string): Promise<void> {
    const me = this.auth.user();
    if (!me) throw new Error('Вы не авторизованы');

    const partnerEmail = partnerEmailRaw.trim().toLowerCase();
    if (!partnerEmail) throw new Error('Введите email партнёра');

    const myEmail = (me.email ?? '').toLowerCase();
    if (myEmail === partnerEmail) throw new Error('Нельзя добавить пару с самим собой');

    // 1) ищем uid партнёра по publicUsers
    const publicCol = collection(this.fs, 'publicUsers');
    const qUser = query(publicCol, where('email', '==', partnerEmail));
    const snap = await getDocs(qUser);
    if (snap.empty) throw new Error('Пользователь с таким email не найден');

    const partnerUid = snap.docs[0].id;

    // 2) pairId (детерминированный)
    const a = me.uid;
    const b = partnerUid;
    const pairId = a < b ? `${a}_${b}` : `${b}_${a}`;

    const invitesCol = collection(this.fs, 'pairInvites');

    // проверки дублей
    const qOut = query(
      invitesCol,
      where('fromUid', '==', a),
      where('toUid', '==', b),
      where('status', '==', 'pending')
    );
    const outSnap = await getDocs(qOut);
    if (!outSnap.empty) throw new Error('Вы уже отправили приглашение этому пользователю');

    const qIn = query(
      invitesCol,
      where('fromUid', '==', b),
      where('toUid', '==', a),
      where('status', '==', 'pending')
    );
    const inSnap = await getDocs(qIn);
    if (!inSnap.empty) throw new Error('У вас уже есть входящее приглашение от этого пользователя');

    const inviteRef = doc(invitesCol) as unknown as DocumentReference<PairInvite>;

    const invite: WithFieldValue<PairInvite> = {
      pairId,
      fromUid: a,
      toUid: b,
      fromEmail: myEmail,
      toEmail: partnerEmail,
      status: 'pending',
      createdAt: serverTimestamp(),
    };

    await setDoc(inviteRef, invite);
  }

  async acceptInvite(inviteId: string): Promise<void> {
    const me = this.auth.user();
    if (!me) throw new Error('Вы не авторизованы');

    const inviteRef = doc(this.fs, `pairInvites/${inviteId}`) as unknown as DocumentReference<PairInvite>;
    const myRef = doc(this.fs, `users/${me.uid}`) as unknown as DocumentReference<User>;

    await runTransaction(this.fs, async (tx) => {
      const invSnap = await tx.get(inviteRef);
      if (!invSnap.exists()) throw new Error('Приглашение не найдено');

      const inv = invSnap.data();
      if (!inv) throw new Error('Приглашение не найдено');

      if (inv.toUid !== me.uid) throw new Error('Это приглашение не для вас');
      if (inv.status !== 'pending') throw new Error('Приглашение уже обработано');

      const mySnap = await tx.get(myRef);
      if (!mySnap.exists()) throw new Error('Ваш профиль users/{uid} не найден');

      const myPairId = mySnap.data()?.pairId ?? null;
      if (myPairId) throw new Error('Вы уже состоите в паре');

      const pairRef = doc(this.fs, `pairs/${inv.pairId}`) as unknown as DocumentReference<Pair>;
      const members = [inv.fromUid, inv.toUid].sort();

      const pairUpsert: WithFieldValue<Pair> = {
        members,
        status: 'active',
        endedAt: null,
        endedBy: null,
        createdAt: serverTimestamp(),
        reactivatedAt: serverTimestamp(),
      };

      tx.set(pairRef, pairUpsert, { merge: true });

      tx.update(myRef, {
        pairId: inv.pairId,
        partnerUid: inv.fromUid,
        partnerEmail: inv.fromEmail,
        updatedAt: serverTimestamp(),
      });

      tx.update(inviteRef, {
        status: 'accepted',
        acceptedAt: serverTimestamp(),
      });
    });
  }

  async declineInvite(inviteId: string): Promise<void> {
    const me = this.auth.user();
    if (!me) throw new Error('Вы не авторизованы');

    const inviteRef = doc(this.fs, `pairInvites/${inviteId}`) as unknown as DocumentReference<PairInvite>;

    await runTransaction(this.fs, async (tx) => {
      const invSnap = await tx.get(inviteRef);
      if (!invSnap.exists()) throw new Error('Приглашение не найдено');

      const inv = invSnap.data();
      if (!inv) throw new Error('Приглашение не найдено');

      if (inv.toUid !== me.uid) throw new Error('Это приглашение не для вас');
      if (inv.status !== 'pending') throw new Error('Приглашение уже обработано');

      tx.update(inviteRef, { status: 'declined' });
    });
  }

  async attachAcceptedInviteAsSender(inviteId: string): Promise<void> {
    const me = this.auth.user();
    if (!me) throw new Error('Вы не авторизованы');

    const inviteRef = doc(this.fs, `pairInvites/${inviteId}`) as unknown as DocumentReference<PairInvite>;
    const myRef = doc(this.fs, `users/${me.uid}`) as unknown as DocumentReference<User>;

    await runTransaction(this.fs, async (tx) => {
      const invSnap = await tx.get(inviteRef);
      if (!invSnap.exists()) return;

      const inv = invSnap.data();
      if (!inv) return;

      if (inv.fromUid !== me.uid) return;
      if (inv.status !== 'accepted') return;

      const mySnap = await tx.get(myRef);
      if (!mySnap.exists()) return;

      const myPairId = mySnap.data()?.pairId ?? null;
      if (myPairId) return;

      const pairRef = doc(this.fs, `pairs/${inv.pairId}`) as unknown as DocumentReference<Pair>;
      const pairSnap = await tx.get(pairRef);
      if (!pairSnap.exists()) return;

      const pair = pairSnap.data();
      const ended = pair?.status === 'ended' || pair?.endedAt != null;
      if (ended) return;

      tx.set(
        myRef,
        {
          pairId: inv.pairId,
          partnerUid: inv.toUid,
          partnerEmail: inv.toEmail,
          updatedAt: serverTimestamp(),
        } satisfies WithFieldValue<User>,
        { merge: true }
      );
    });
  }

  async breakPair(): Promise<void> {
    const me = this.auth.user();
    if (!me) throw new Error('Вы не авторизованы');

    const myRef = doc(this.fs, `users/${me.uid}`) as unknown as DocumentReference<User>;
    const mySnap = await getDoc(myRef);

    const pairId = mySnap.data()?.pairId ?? null;
    if (!pairId) throw new Error('Вы не состоите в паре');

    const pairRef = doc(this.fs, `pairs/${pairId}`) as unknown as DocumentReference<Pair>;

    await runTransaction(this.fs, async (tx) => {
      const pairSnap = await tx.get(pairRef);

      if (!pairSnap.exists()) {
        tx.set(
          myRef,
          {
            pairId: null,
            partnerUid: null,
            partnerEmail: null,
            updatedAt: serverTimestamp(),
          } satisfies WithFieldValue<User>,
          { merge: true }
        );
        return;
      }

      const pair = pairSnap.data();
      const members = Array.isArray(pair?.members) ? pair.members : [];
      if (!members.includes(me.uid)) throw new Error('Нет доступа к этой паре');

      tx.update(pairRef, {
        status: 'ended',
        endedAt: serverTimestamp(),
        endedBy: me.uid,
      });

      tx.set(
        myRef,
        {
          pairId: null,
          partnerUid: null,
          partnerEmail: null,
          updatedAt: serverTimestamp(),
        } satisfies WithFieldValue<User>,
        { merge: true }
      );
    });
  }

  async syncEndedPairOnOpen(pairId: string): Promise<void> {
    const me = this.auth.user();
    if (!me) return;

    const myRef = doc(this.fs, `users/${me.uid}`) as unknown as DocumentReference<User>;
    const pairRef = doc(this.fs, `pairs/${pairId}`) as unknown as DocumentReference<Pair>;

    const pairSnap = await getDoc(pairRef);

    if (!pairSnap.exists()) {
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
      return;
    }

    const pair = pairSnap.data();
    const ended = pair?.status === 'ended' || pair?.endedAt != null;
    if (!ended) return;

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