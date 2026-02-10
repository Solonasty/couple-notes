export type UserProfile = {
  email?: string;
  name?: string;
  pairId?: string | null;
  partnerUid?: string | null;
  partnerEmail?: string | null;
};

export type PairInvite = {
  pairId: string;
  fromUid: string;
  toUid: string;
  fromEmail: string;
  toEmail: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt?: unknown;
  acceptedAt?: unknown;
};

export type PairDoc = {
  members: string[];
  createdAt?: unknown;
};

export type PairInviteDoc = PairInvite & { id: string };
