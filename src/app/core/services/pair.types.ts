import { Timestamp } from "@angular/fire/firestore";

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
  status?: 'active' | 'ended';
  endedAt?: unknown;
  endedBy?: string;
};

export type PairInviteDoc = PairInvite & { id: string };

export type Note = {
  id: string;
  text: string;
  ownerUid: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};