import { Injectable, inject } from '@angular/core';
import { Firestore, doc, setDoc, serverTimestamp, runTransaction, docData } from '@angular/fire/firestore';
import { Timestamp, type DocumentReference, type WithFieldValue } from 'firebase/firestore';
import { AuthService } from './auth.service';
import { PairCodeInvite } from '../models/pair-code-invite.type';
import { Pair } from '@/app/core/models/pair.type';
import { Observable } from 'rxjs';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LEN = 6;
const TTL_MS = 10 * 60 * 1000;

function isPermissionDenied(e: unknown): boolean {
  return typeof e === 'object'
    && e !== null
    && 'code' in e
    && (e as any).code === 'permission-denied';
}

@Injectable({ providedIn: 'root' })
export class PairCodeService {
  private fs = inject(Firestore);
  private auth = inject(AuthService);

  normalizeCode(code: string): string {
    return (code ?? '')
      .toUpperCase()
      .replace(/[^A-Z2-9]/g, '')
      .trim();
  }

  async createInvite(): Promise<string> {
    const me = this.auth.user();
    if (!me) throw new Error('Вы не авторизованы');

    for (let attempt = 0; attempt < 8; attempt++) {
      const code = this.generateCode();
      const ref = doc(this.fs, `pairCodes/${code}`) as unknown as DocumentReference<PairCodeInvite>;

      const expiresAt = Timestamp.fromDate(new Date(Date.now() + TTL_MS));

      const payload: WithFieldValue<PairCodeInvite> = {
        code,
        inviterUid: me.uid,
        status: 'open',
        createdAt: serverTimestamp(),
        expiresAt,
        usedByUid: null,
        usedAt: null,
        pairId: null,
      };

      try {
        await setDoc(ref, payload);
        return code;
      } catch (e: unknown) {
        if (isPermissionDenied(e)) continue;
        throw e instanceof Error ? e : new Error('Не удалось создать код');
      }
    }

    throw new Error('Не удалось создать код. Попробуйте ещё раз.');
  }

  private generateCode(): string {
    const bytes = new Uint8Array(CODE_LEN);
    crypto.getRandomValues(bytes);

    let out = '';
    for (let i = 0; i < CODE_LEN; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
    return out;
  }

  async useCodeAndCreatePair(codeRaw: string): Promise<string> {
    const me = this.auth.user();
    if (!me) throw new Error('Вы не авторизованы');

    const myPairId = this.auth.profile()?.pairId ?? null;
    if (myPairId) throw new Error('Вы уже состоите в паре');

    const code = this.normalizeCode(codeRaw);
    if (!code || code.length !== 6) throw new Error('Введите корректный код');

    const inviteRef = doc(this.fs, `pairCodes/${code}`) as unknown as DocumentReference<PairCodeInvite>;

    const pairId = await runTransaction(this.fs, async (tx) => {
      const snap = await tx.get(inviteRef);
      if (!snap.exists()) throw new Error('Код не найден');

      const inv = snap.data();
      if (!inv) throw new Error('Код не найден');

      if (inv.status !== 'open') throw new Error('Код уже использован или недействителен');

      const exp = inv.expiresAt as unknown as Timestamp | null | undefined;
      if (!exp || exp.toMillis() <= Date.now()) throw new Error('Срок действия кода истёк');

      const inviterUid = inv.inviterUid;
      if (!inviterUid) throw new Error('Код недействителен');
      if (inviterUid === me.uid) throw new Error('Нельзя использовать свой код');

      const a = me.uid;
      const b = inviterUid;
      const pairId = a < b ? `${a}_${b}` : `${b}_${a}`;
      const members = [a, b].sort();

      const pairRef = doc(this.fs, `pairs/${pairId}`) as unknown as DocumentReference<Pair>;

      const pairUpsert: WithFieldValue<Pair> = {
        members,
        status: 'active',
        endedAt: null,
        endedBy: null,
        createdAt: serverTimestamp(),
        reactivatedAt: serverTimestamp(),
      };

      tx.set(pairRef, pairUpsert, { merge: true });

      tx.update(inviteRef, {
        status: 'used',
        usedByUid: me.uid,
        usedAt: serverTimestamp(),
        pairId,
      });

      return pairId;
    });

    return pairId;
  }

  watchInvite(codeRaw: string): Observable<PairCodeInvite> {
    const code = this.normalizeCode(codeRaw);
    const ref = doc(this.fs, `pairCodes/${code}`) as unknown as DocumentReference<PairCodeInvite>;
    return docData(ref) as Observable<PairCodeInvite>;
  }
}