import { FsTime } from "./fs-time.type";

export type Note = {
    id: string;
    text: string;
    ownerUid: string;
    ownerName: string;
    createdAt?: FsTime;
    updatedAt?: FsTime;
};