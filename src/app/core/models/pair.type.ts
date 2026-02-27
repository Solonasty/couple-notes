import { FsTime } from "./fs-time.type";

export type Pair = {
    id?: string;
    members?: string[];
    status?: PairStatus;
    createdAt?: FsTime;
    reactivatedAt?: FsTime;
    endedAt?: FsTime;
    endedBy?: string | null;
};

export type PairStatus = "active" | "ended";

export type ActivePair = Pair | null;