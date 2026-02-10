import { Injectable, inject } from '@angular/core';
import { Firestore, collection, doc, getDocs, query, runTransaction, serverTimestamp, setDoc, where } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { PairInvite } from './pair.types';
import { getDoc, updateDoc } from '@angular/fire/firestore';


@Injectable({ providedIn: 'root' })
export class PairService {
  private fs = inject(Firestore);
  private auth = inject(AuthService);

  async createPairByEmail(partnerEmailRaw: string): Promise<void> {
    const me = this.auth.user();
    if (!me) throw new Error('Вы не авторизованы');

    const partnerEmail = partnerEmailRaw.trim().toLowerCase();
    if (!partnerEmail) throw new Error('Введите email партнёра');

    const myEmail = (me.email ?? '').toLowerCase();
    if (myEmail === partnerEmail) throw new Error('Нельзя добавить пару с самим собой');

    // 1) ищем uid партнёра по publicUsers
    const publicCol = collection(this.fs, 'publicUsers');
    const q = query(publicCol, where('email', '==', partnerEmail));
    const snap = await getDocs(q);

    if (snap.empty) {
      throw new Error('Пользователь с таким email не найден');
    }

    const partnerUid = snap.docs[0].id;

    // 2) детерминированный pairId, чтобы не было дублей
    const a = me.uid;
    const b = partnerUid;
    const pairId = a < b ? `${a}_${b}` : `${b}_${a}`;

    // inviteId тоже делаем детерминированным
    const inviteId = pairId;
    const inviteRef = doc(this.fs, `pairInvites/${inviteId}`);

    const invite: PairInvite = {
      pairId,
      fromUid: a,
      toUid: b,
      fromEmail: myEmail,
      toEmail: partnerEmail,
      status: 'pending',
      createdAt: serverTimestamp(),
    };

    // создаём приглашение (если уже есть — перезапишем pending)
    await setDoc(inviteRef, invite, { merge: true });
  }

  async acceptInvite(inviteId: string): Promise<void> {
    const me = this.auth.user();
    if (!me) throw new Error('Вы не авторизованы');

    const inviteRef = doc(this.fs, `pairInvites/${inviteId}`);
    const myRef = doc(this.fs, `users/${me.uid}`);
    const pairRef = doc(this.fs, `pairs/${inviteId}`);

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

      // создаём/обновляем документ пары
      tx.set(pairRef, {
        members: [inv.fromUid, inv.toUid],
        createdAt: serverTimestamp(),
      }, { merge: true });

      // записываем pairId только себе
      tx.update(myRef, {
        pairId: inv.pairId,
        partnerUid: inv.fromUid,
        partnerEmail: inv.fromEmail,
        updatedAt: serverTimestamp(),
      });

      // помечаем приглашение как принятое
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

      // только отправитель
      if (inv.fromUid !== me.uid) return;

      // интересует только accepted
      if (inv.status !== 'accepted') return;

      const mySnap = await tx.get(myRef);
      if (!mySnap.exists()) throw new Error('Ваш профиль users/{uid} не найден');

      const myPairId = (mySnap.data() as any)?.pairId ?? null;
      if (myPairId) return; // уже в паре

      tx.update(myRef, {
        pairId: inv.pairId,
        partnerUid: inv.toUid,
        partnerEmail: inv.toEmail,
        updatedAt: serverTimestamp(),
      });
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

    const ended = pair?.status === 'ended' || !!pair?.endedAt;
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
