import { signal } from '@angular/core';
import { EMPTY, of } from 'rxjs';

import { Firestore } from '@angular/fire/firestore';

import { AuthService } from '../services/auth.service';
import { PairContextService } from '../services/pair-context.service';
import { ReportsService } from '../services/reports.service';
import { PairProfileSyncService } from '../services/pair-profile-sync.service';

import type { User, UserCredential } from 'firebase/auth';

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  disableNetwork,
  type Firestore as FirebaseFirestore,
} from 'firebase/firestore';

let _app: FirebaseApp | null = null;
let _fs: FirebaseFirestore | null = null;

function getTestFirestore(): FirebaseFirestore {
  if (_fs) return _fs;

  _app =
    getApps()[0] ??
    initializeApp({
      projectId: 'demo-test',
      apiKey: 'fake-api-key',
      appId: '1:123:web:123',
    });

  _fs = getFirestore(_app);

  void disableNetwork(_fs).catch((err) => {
    console.warn('[test] disableNetwork failed:', err);
  });

  return _fs;
}

export function provideAppTestProviders() {
  const userMock = { uid: 'test-uid', email: 'test@example.com' } as unknown as User;

  const userCredentialMock: UserCredential = {
    user: userMock,
    providerId: 'password',
    operationType: 'signIn',
  } as unknown as UserCredential;

  return [
    { provide: Firestore, useFactory: getTestFirestore },

    {
      provide: AuthService,
      useValue: {
        user$: of(userMock),
        user: signal<User | null>(userMock),
        signIn: async () => undefined,
        signUp: async () => userCredentialMock,
        logout: async () => undefined,
      } satisfies Partial<AuthService>,
    },

    {
      provide: PairContextService,
      useValue: {
        activePair$: of(null),
      } satisfies Partial<PairContextService>,
    },

    {
      provide: ReportsService,
      useValue: {
        schedule$: of({
          inPair: false,
          pairId: null,
          uid: null,
          slotEnd: null,
          slotStart: null,
          reportId: null,
          nextAt: null,
          msToNext: null,
          due: false,
        }),
        report$: of(null),
        generateWeekly: async () => undefined,
      } satisfies Partial<ReportsService>,
    },

    {
      provide: PairProfileSyncService,
      useValue: {
        init: () => EMPTY,
      } satisfies Partial<PairProfileSyncService>,
    },
  ];
}
