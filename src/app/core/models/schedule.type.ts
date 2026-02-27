export type Schedule = {
    inPair: boolean;
    pairId: string | null;
    uid: string | null;
    slotEnd: Date | null;
    slotStart: Date | null;
    reportId: string | null;
    nextAt: Date | null;
    msToNext: number | null;
    due: boolean;
};