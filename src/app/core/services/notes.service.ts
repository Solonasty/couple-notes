import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
  query,
  orderBy,
  where,
} from '@angular/fire/firestore';
import { addDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Observable, of, switchMap, map, catchError, shareReplay } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { Note, UserProfile, PairDoc } from './pair.types';

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

  private profile$(uid: string): Observable<UserProfile | null> {
    return docData(doc(this.fs, `users/${uid}`)) as unknown as Observable<UserProfile>;
  }

  private pair$(pairId: string): Observable<PairDoc | null> {
    return docData(doc(this.fs, `pairs/${pairId}`)) as unknown as Observable<PairDoc>;
  }

  private ctx$ = this.auth.user$.pipe(
    switchMap(user => {
      if (!user) return of({ mode: 'none' } as NotesContext);

      return this.profile$(user.uid).pipe(
        switchMap(profile => {
          const pairId = profile?.pairId ?? null;
          if (!pairId) return of({ mode: 'solo', uid: user.uid } as NotesContext);

          return this.pair$(pairId).pipe(
            map(pair => {
              const ok =
                pair?.status === 'active' &&
                Array.isArray(pair?.members) &&
                pair!.members.includes(user.uid);

              return ok
                ? ({ mode: 'pair', uid: user.uid, pairId } as NotesContext)
                : ({ mode: 'solo', uid: user.uid } as NotesContext);
            }),
            catchError(() => of({ mode: 'solo', uid: user.uid } as NotesContext))
          );
        })
      );
    }),
    shareReplay(1)
  );

  private async getCtx(): Promise<UserNotesContext> {
    return firstValueFrom(this.ctx$.pipe(filter(isUserCtx), take(1)));
  }

  private notesCollection(ctx: NotesContext) {
    if (ctx.mode === 'pair') return collection(this.fs, `pairs/${ctx.pairId}/notes`);
    if (ctx.mode === 'solo') return collection(this.fs, `users/${ctx.uid}/notes`);
    throw new Error('Not authenticated');
  }

  notes$(): Observable<Note[]> {
    return this.ctx$.pipe(
      switchMap(ctx => {
        if (ctx.mode === 'none') return of([] as Note[]);

        // фильтруем по ownerUid
        const q =
          ctx.mode === 'pair'
            ? query(
                this.notesCollection(ctx),
                where('ownerUid', '==', ctx.uid),
                orderBy('updatedAt', 'desc')
              )
            : query(this.notesCollection(ctx), orderBy('updatedAt', 'desc'));

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
