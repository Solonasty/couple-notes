import { Injectable, inject } from '@angular/core';
import { Firestore, collection, doc, getDocs, query, runTransaction, serverTimestamp, setDoc, where } from '@angular/fire/firestore';
import { AuthService } from './auth.service';

type PairInvite = {
  pairId: string;
  fromUid: string;
  toUid: string;
  fromEmail: string;
  toEmail: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt?: any;
  acceptedAt?: any;
};

@Injectable({ providedIn: 'root' })
export class PairService {
  private fs = inject(Firestore);
  private auth = inject(AuthService);

  /**
   * Создаём приглашение партнёру по email.
   * НЕ читаем и НЕ пишем users/{partnerUid} (это запрещено rules и небезопасно).
   */
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

  /**
   * Принять приглашение (это делает получатель).
   * Пишем pairId только в СВОЙ users/{uid} — это разрешено rules.
   */
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
        updatedAt: serverTimestamp(),
      });

      // помечаем приглашение как принятое
      tx.update(inviteRef, {
        status: 'accepted',
        acceptedAt: serverTimestamp(),
      });
    });
  }

  /**
   * (Опционально) Отклонить приглашение
   */
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
}
