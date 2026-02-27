import { FieldValue, Timestamp } from 'firebase/firestore';

/** READ: что приходит из Firestore */
export type FsTime = Timestamp | null | undefined;

/** WRITE: что отправляем в Firestore */
export type FsWriteTime = FieldValue;