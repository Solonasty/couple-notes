import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  query,
  orderBy,
  where,
} from '@angular/fire/firestore';
import {
  addDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  Observable,
  of,
  switchMap,
  map,
  shareReplay,
  combineLatest,
  firstValueFrom,
  filter,
  take,
} from 'rxjs';

import { AuthService } from './auth.service';
import { PairContextService } from './pair-context.service';
import { PairNotesCtx } from '../models/pair-note-ctx.type';
import { Note } from '../models/note.type';

function hasPair(ctx: PairNotesCtx | null): ctx is PairNotesCtx {
  return !!ctx;
}

@Injectable({ providedIn: 'root' })
export class NotesService {
  private fs = inject(Firestore);
  private auth = inject(AuthService);
  private pairCtx = inject(PairContextService);

  private ctx$ = combineLatest([this.auth.user$, this.pairCtx.activePair$]).pipe(
    map(([user, activePair]): PairNotesCtx | null => {
      if (!user || !activePair) return null;
      return { uid: user.uid, pairId: activePair.id || '' };
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  private async getCtx(): Promise<PairNotesCtx> {
    return firstValueFrom(this.ctx$.pipe(filter(hasPair), take(1)));
  }

  private col(ctx: PairNotesCtx) {
    return collection(this.fs, `pairs/${ctx.pairId}/notes`);
  }

  notes$(): Observable<Note[]> {
    return this.ctx$.pipe(
      switchMap((ctx) => {
        if (!ctx) return of([] as Note[]);

        const q = query(
          this.col(ctx),
          where('ownerUid', '==', ctx.uid),
          orderBy('createdAt', 'desc')
        );

        return collectionData(q, { idField: 'id' }) as unknown as Observable<Note[]>;
      })
    );
  }

  async add(text: string) {
    const uid = this.auth.uid();
    if (!uid) throw new Error('Not authenticated');

    const ctx = await this.getCtx();

    const data = {
      text,
      ownerUid: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    return addDoc(this.col(ctx), data);
  }

  async update(id: string, text: string) {
    const uid = this.auth.uid();
    if (!uid) throw new Error('Not authenticated');

    const ctx = await this.getCtx();

    const patch = {
      text,
      updatedAt: serverTimestamp(),
    };

    return updateDoc(doc(this.fs, `pairs/${ctx.pairId}/notes/${id}`), patch);
  }

  async remove(id: string) {
    const uid = this.auth.uid();
    if (!uid) throw new Error('Not authenticated');

    const ctx = await this.getCtx();
    return deleteDoc(doc(this.fs, `pairs/${ctx.pairId}/notes/${id}`));
  }
}