import { WorkDayRecord } from '@/models';
import type { WorkDayRecordRow } from '@/lib/rows';
import type {
    AutoScheduleEntry,
    WorkDayCheckMode,
    WorkDayClassification,
    WorkDayRecordSource,
    WorkSessionAnomaly,
} from 'shared/src/schemas/database';
import type { DateKey } from 'shared/src/lib/day-key';

export interface WorkDayRecordDoc {
    userId: string;
    date: DateKey;
    classification: WorkDayClassification;
    checkMode: WorkDayCheckMode;
    timetableIntervals: AutoScheduleEntry[];
    expectedHours: number;
    toleranceMinutes: number;
    timetableToleranceMinutes: number;
    anomalies: WorkSessionAnomaly[];
    source: WorkDayRecordSource;
    editedBy?: string;
    editReason?: string;
    editReasonEncrypted?: string;
    computedAt: Date;
}

export const findOneWorkDayRecord = (userId: string, date: DateKey) =>
    WorkDayRecord.findOne({ userId, date });

export const findWorkDayRecords = (
    dates: DateKey[],
    userId?: string | { $in: string[] }
) =>
    WorkDayRecord.find({
        date: { $in: dates },
        ...(userId !== undefined ? { userId } : {}),
    }).lean<WorkDayRecordRow[]>();

export const findUserWorkDayRecords = (
    userId: string,
    fromKey: DateKey,
    toKey: DateKey
) =>
    WorkDayRecord.find({
        userId,
        date: { $gte: fromKey, $lte: toKey },
    });

export const upsertWorkDayRecord = async (
    doc: WorkDayRecordDoc
): Promise<WorkDayRecordRow | null> =>
    WorkDayRecord.findOneAndUpdate(
        { userId: doc.userId, date: doc.date },
        {
            $set: { ...doc, updatedAt: new Date() },
            $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true, new: true }
    ).lean<WorkDayRecordRow>();
