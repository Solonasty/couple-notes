import { FieldValue, Timestamp } from "firebase/firestore";

export type FsTime = Timestamp | FieldValue | null | undefined;
