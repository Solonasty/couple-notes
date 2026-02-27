import { FsTime } from "./fs-time.type";

export type PairInvite = {
    pairId: string;
    fromUid: string;
    toUid: string;
    fromEmail: string;
    toEmail: string;
    status: PairInviteStatus;
    createdAt?: FsTime;
    acceptedAt?: FsTime;
};

export type PairInviteStatus = 'pending' | "accepted" | "declined";