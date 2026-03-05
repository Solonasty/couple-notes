import { FsTime } from './fs-time.type';

export type PairCodeStatus = 'open' | 'used' | 'cancelled' | 'expired';

export type PairCodeInvite = {
  code: string;
  inviterUid: string;
  status: PairCodeStatus;
  createdAt?: FsTime;
  expiresAt?: FsTime;
  usedByUid?: string | null;
  usedAt?: FsTime;
  pairId?: string | null;
};