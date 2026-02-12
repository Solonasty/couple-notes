import { Injectable, inject } from '@angular/core';
import { Firestore, collection, doc, getDocs, query, runTransaction, serverTimestamp, setDoc, where } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { PairInvite } from './pair.types';
import { getDoc } from '@angular/fire/firestore';
import { combineLatest, map, shareReplay } from 'rxjs';
import { PairContextService } from './pair-context.service';


@Injectable({ providedIn: 'root' })
export class PairService {
  private fs = inject(Firestore);
  private auth = inject(AuthService);

  private pairCtx = inject(PairContextService);

  private ctx$ = combineLatest([this.auth.user$, this.pairCtx.activePair$]).pipe(
    map(([user, activePair]) => {
      if (!user) return { mode: 'none' as const };
      if (activePair) return { mode: 'pair' as const, uid: user.uid, pairId: activePair.id };
      return { mode: 'solo' as const, uid: user.uid };
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

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

    //  Проверки дублей (rules это разрешат, потому что фильтруем by fromUid/toUid)
    const qOut = query(invitesCol, where('fromUid', '==', a), where('toUid', '==', b), where('status', '==', 'pending'));
    const outSnap = await getDocs(qOut);
    if (!outSnap.empty) throw new Error('Вы уже отправили приглашение этому пользователю');

    const qIn = query(invitesCol, where('fromUid', '==', b), where('toUid', '==', a), where('status', '==', 'pending'));
    const inSnap = await getDocs(qIn);
    if (!inSnap.empty) throw new Error('У вас уже есть входящее приглашение от этого пользователя');

    //  ВАЖНО: inviteId теперь НЕ pairId. Это новый документ каждый раз.
    const inviteRef = doc(invitesCol);

    const invite: PairInvite = {
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

    const inviteRef = doc(this.fs, `pairInvites/${inviteId}`);
    const myRef = doc(this.fs, `users/${me.uid}`);

    await runTransaction(this.fs, async (tx) => {
      const invSnap = await tx.get(inviteRef);
      if (!invSnap.exists()) throw new Error('Приглашение не найдено');

      const inv = invSnap.data() as PairInvite;

      if (inv.toUid !== me.uid) throw new Error('Это приглашение не для вас');
      if (inv.status !== 'pending') throw new Error('Приглашение уже обработано');

      const mySnap = await tx.get(myRef);
      if (!mySnap.exists()) throw new Error('Ваш профиль users/{uid} не найден');

      const myPairId = (mySnap.data() as any)?.pairId ?? null;
      if (myPairId) throw new Error('Вы уже состоите в паре');

      //  пары всегда по pairId
      const pairRef = doc(this.fs, `pairs/${inv.pairId}`);

      // всегда сортируем members, чтобы никогда не ломать rules по сравнению массивов
      const members = [inv.fromUid, inv.toUid].sort();

      // если пара была ended — реактивируем (endedAt/endedBy в null, не deleteField)
      tx.set(pairRef, {
        members,
        status: 'active',
        endedAt: null,
        endedBy: null,
        createdAt: serverTimestamp(),
        reactivatedAt: serverTimestamp(),
      }, { merge: true });

      // пишем себе пару
      tx.update(myRef, {
        pairId: inv.pairId,
        partnerUid: inv.fromUid,
        partnerEmail: inv.fromEmail,
        updatedAt: serverTimestamp(),
      });

      // отмечаем инвайт принятым
      tx.update(inviteRef, {
        status: 'accepted',
        acceptedAt: serverTimestamp(),
      });
    });
  }

  async declineInvite(inviteId: string): Promise<void> {
    const me = this.auth.user();
    if (!me) throw new Error('Вы не авторизованы');

    const inviteRef = doc(this.fs, `pairInvites/${inviteId}`);

    await runTransaction(this.fs, async (tx) => {
      const invSnap = await tx.get(inviteRef);
      if (!invSnap.exists()) throw new Error('Приглашение не найдено');

      const inv = invSnap.data() as any;
      if (inv.toUid !== me.uid) throw new Error('Это приглашение не для вас');
      if (inv.status !== 'pending') throw new Error('Приглашение уже обработано');

      tx.update(inviteRef, { status: 'declined' });
    });
  }

  async attachAcceptedInviteAsSender(inviteId: string): Promise<void> {
    const me = this.auth.user();
    if (!me) throw new Error('Вы не авторизованы');

    const inviteRef = doc(this.fs, `pairInvites/${inviteId}`);
    const myRef = doc(this.fs, `users/${me.uid}`);

    await runTransaction(this.fs, async (tx) => {
      const invSnap = await tx.get(inviteRef);
      if (!invSnap.exists()) return;

      const inv = invSnap.data() as PairInvite;

      if (inv.fromUid !== me.uid) return;
      if (inv.status !== 'accepted') return;

      const mySnap = await tx.get(myRef);
      if (!mySnap.exists()) return;

      const myPairId = (mySnap.data() as any)?.pairId ?? null;
      if (myPairId) return; // уже в паре

      //  проверяем, что пара активна (иначе НЕ прикрепляем старую ended пару)
      const pairRef = doc(this.fs, `pairs/${inv.pairId}`);
      const pairSnap = await tx.get(pairRef);
      if (!pairSnap.exists()) return;

      const pair = pairSnap.data() as any;
      const ended = pair?.status === 'ended' || !!pair?.endedAt;
      if (ended) return;

      //  set merge вместо update — надёжнее
      tx.set(myRef, {
        pairId: inv.pairId,
        partnerUid: inv.toUid,
        partnerEmail: inv.toEmail,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    });
  }

  async breakPair(): Promise<void> {
    const me = this.auth.user();
    if (!me) throw new Error('Вы не авторизованы');

    const myRef = doc(this.fs, `users/${me.uid}`);
    const mySnap = await getDoc(myRef);
    const pairId = (mySnap.data() as any)?.pairId ?? null;

    if (!pairId) throw new Error('Вы не состоите в паре');

    const pairRef = doc(this.fs, `pairs/${pairId}`);

    await runTransaction(this.fs, async (tx) => {
      const pairSnap = await tx.get(pairRef);
      if (!pairSnap.exists()) {
        // если пары нет — просто чистим профиль
        tx.set(myRef, {
          pairId: null,
          partnerUid: null,
          partnerEmail: null,
          updatedAt: serverTimestamp(),
        }, { merge: true });
        return;
      }

      const pair = pairSnap.data() as any;
      const members: string[] = pair?.members ?? [];
      if (!members.includes(me.uid)) throw new Error('Нет доступа к этой паре');

      // помечаем пару завершённой (members не трогаем)
      tx.update(pairRef, {
        status: 'ended',
        endedAt: serverTimestamp(),
        endedBy: me.uid,
      });

      // чистим ТОЛЬКО свой профиль
      tx.set(myRef, {
        pairId: null,
        partnerUid: null,
        partnerEmail: null,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    });
  }

  async syncEndedPairOnOpen(pairId: string): Promise<void> {
    const me = this.auth.user();
    if (!me) return;

    const myRef = doc(this.fs, `users/${me.uid}`);
    const pairRef = doc(this.fs, `pairs/${pairId}`);

    const pairSnap = await getDoc(pairRef);

    // если пары нет — считаем что она неактуальна и чистим профиль
    if (!pairSnap.exists()) {
      await setDoc(myRef, {
        pairId: null,
        partnerUid: null,
        partnerEmail: null,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      return;
    }

    const pair = pairSnap.data() as any;

    const ended = pair?.status === 'ended' || (pair?.endedAt != null);

    if (!ended) return;

    // чистим только свой профиль
    await setDoc(myRef, {
      pairId: null,
      partnerUid: null,
      partnerEmail: null,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }
}
