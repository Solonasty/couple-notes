import { FieldValue } from "firebase/firestore";

export type User = {
    email?: string | null;
    name?: string | null;
    pairId?: string | null;
    partnerUid?: string | null;
    partnerEmail?: string | null;
    updatedAt?: FieldValue;
};