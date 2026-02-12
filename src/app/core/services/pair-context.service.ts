import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  query,
  where,
  limit,
} from '@angular/fire/firestore';
import { Observable, of, switchMap, map, shareReplay, catchError } from 'rxjs';
import { AuthService } from './auth.service';
import { PairDoc } from './pair.types';

export type ActivePair = (PairDoc & { id: string }) | null;

@Injectable({ providedIn: 'root' })
export class PairContextService {
  private fs = inject(Firestore);
  private auth = inject(AuthService);

  /** Единственный источник правды: активная пара берётся из /pairs */
  readonly activePair$: Observable<ActivePair> = this.auth.user$.pipe(
    switchMap(user => {
      if (!user) return of(null);

      const q = query(
        collection(this.fs, 'pairs'),
        where('members', 'array-contains', user.uid),
        where('status', '==', 'active'),
        limit(1)
      );

      return (collectionData(q, { idField: 'id' }) as unknown as Observable<(PairDoc & { id: string })[]>).pipe(
        map(arr => (arr.length ? arr[0] : null))
      );
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );
}
