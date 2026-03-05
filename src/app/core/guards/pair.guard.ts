import { inject } from '@angular/core';
import { CanMatchFn } from '@angular/router';
import { AuthService } from './auth.service';
import { filter, map, switchMap, take } from 'rxjs/operators';
import type { User as Profile } from '../models/user.type';

const notNullish = <T>(v: T | null | undefined): v is T => v != null;

export const hasPairGuard: CanMatchFn = () => {
  const auth = inject(AuthService);

  return auth.user$.pipe(
    filter(notNullish),
    take(1),
    switchMap(() => auth.profile$.pipe(
      filter(notNullish),
      take(1),
    )),
    map((profile: Profile) => !!profile.pairId)
  );
};

export const noPairGuard: CanMatchFn = () => {
  const auth = inject(AuthService);

  return auth.user$.pipe(
    filter(notNullish),
    take(1),
    switchMap(() => auth.profile$.pipe(
      filter(notNullish),
      take(1),
    )),
    map((profile: Profile) => !profile.pairId)
  );
};