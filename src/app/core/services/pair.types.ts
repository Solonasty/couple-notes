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
  
  export type PairInviteDoc = PairInvite & { id: string };
  
  export type UserProfile = {
    email?: string;
    name?: string;
    pairId?: string | null;
  };
  
  export type PairDoc = {
    members: string[];
    createdAt?: unknown;
  };
  