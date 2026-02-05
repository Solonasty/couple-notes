import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, addDoc, deleteDoc, query, orderBy } from '@angular/fire/firestore';
import { Timestamp, serverTimestamp } from 'firebase/firestore';
import { Observable, of, switchMap } from 'rxjs';
import { AuthService } from './auth.service';

export type Note = {
  id: string;
  text: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

@Injectable({ providedIn: 'root' })
export class NotesService {
  private fs = inject(Firestore);
  private auth = inject(AuthService);

  private col(uid: string) {
    return collection(this.fs, `users/${uid}/notes`);
  }

  notes$(): Observable<Note[]> {
    return this.auth.user$.pipe(
      switchMap(user => {
        if (!user) return of([] as Note[]);
        const q = query(this.col(user.uid), orderBy('updatedAt', 'desc'));
        return collectionData(q, { idField: 'id' }) as unknown as Observable<Note[]>;
      })
    );
  }

  async add(text: string) {
    const uid = this.auth.uid();
    if (!uid) throw new Error('Not authenticated');
    return addDoc(this.col(uid), { text, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }

  async remove(id: string) {
    const uid = this.auth.uid();
    if (!uid) throw new Error('Not authenticated');
    return deleteDoc(doc(this.fs, `users/${uid}/notes/${id}`));
  }
}
