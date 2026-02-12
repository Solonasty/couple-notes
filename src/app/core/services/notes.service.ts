import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, query, orderBy, where } from '@angular/fire/firestore';
import { addDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Observable, of, switchMap, map, shareReplay, combineLatest, firstValueFrom, filter, take } from 'rxjs';

import { AuthService } from './auth.service';
import { PairContextService } from './pair-context.service';
import { Note } from './pair.types';

type NotesContext =
  | { mode: 'none' }
  | { mode: 'solo'; uid: string }
  | { mode: 'pair'; uid: string; pairId: string };

type UserNotesContext = Exclude<NotesContext, { mode: 'none' }>;

function isUserCtx(ctx: NotesContext): ctx is UserNotesContext {
  return ctx.mode !== 'none';
}

@Injectable({ providedIn: 'root' })
export class NotesService {
  private fs = inject(Firestore);
  private auth = inject(AuthService);
  private pairCtx = inject(PairContextService);

  // ✅ Источник правды: pairs (activePair$), а не users.pairId
  private ctx$ = combineLatest([this.auth.user$, this.pairCtx.activePair$]).pipe(
    map(([user, activePair]): NotesContext => {
      if (!user) return { mode: 'none' };
      if (activePair) return { mode: 'pair', uid: user.uid, pairId: activePair.id };
      return { mode: 'solo', uid: user.uid };
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  private async getCtx(): Promise<UserNotesContext> {
    return firstValueFrom(this.ctx$.pipe(filter(isUserCtx), take(1)));
  }

  private notesCollection(ctx: UserNotesContext) {
    return ctx.mode === 'pair'
      ? collection(this.fs, `pairs/${ctx.pairId}/notes`)
      : collection(this.fs, `users/${ctx.uid}/notes`);
  }

  notes$(): Observable<Note[]> {
    return this.ctx$.pipe(
      switchMap(ctx => {
        if (ctx.mode === 'none') return of([] as Note[]);

        const colRef = this.notesCollection(ctx);

        // ✅ в паре — всегда только свои заметки
        const q =
          ctx.mode === 'pair'
            ? query(colRef, where('ownerUid', '==', ctx.uid), orderBy('updatedAt', 'desc'))
            : query(colRef, orderBy('updatedAt', 'desc'));

        return collectionData(q, { idField: 'id' }) as unknown as Observable<Note[]>;
      })
    );
  }

  async add(text: string) {
    const uid = this.auth.uid();
    if (!uid) throw new Error('Not authenticated');

    const ctx = await this.getCtx();

    return addDoc(this.notesCollection(ctx), {
      text,
      ownerUid: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async update(id: string, text: string) {
    const uid = this.auth.uid();
    if (!uid) throw new Error('Not authenticated');

    const ctx = await this.getCtx();

    const path =
      ctx.mode === 'pair'
        ? `pairs/${ctx.pairId}/notes/${id}`
        : `users/${ctx.uid}/notes/${id}`;

    return updateDoc(doc(this.fs, path), { text, updatedAt: serverTimestamp() });
  }

  async remove(id: string) {
    const uid = this.auth.uid();
    if (!uid) throw new Error('Not authenticated');

    const ctx = await this.getCtx();

    const path =
      ctx.mode === 'pair'
        ? `pairs/${ctx.pairId}/notes/${id}`
        : `users/${ctx.uid}/notes/${id}`;

    return deleteDoc(doc(this.fs, path));
  }
}
