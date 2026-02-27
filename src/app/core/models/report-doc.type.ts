import { FsTime } from "./fs-time.type";

export type ReportDoc = {
    id?: string;
    status: ReportDocStatus;
    createdAt?: FsTime;
    createdBy?: string;
    periodStart?: FsTime;
    periodEnd?: FsTime;
    notesCount?: number;
    summary?: string | null;
    error?: string | null;
    sourceNotes?: ReportSourceNote[];
    updatedAt?: FsTime;
};

export type ReportDocStatus = 'generating' | 'ready' | 'error';

export type ReportSourceNote = {
    id: string;
    text: string;
    ownerUid: string;
    updatedAt?: FsTime;
};
