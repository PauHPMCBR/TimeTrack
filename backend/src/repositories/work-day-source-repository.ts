import { WorkDaySource } from '@/models';
import type { SourceKind } from 'shared/src/schemas/database';

/** Upserts the day-level source of a (user, local "YYYY-MM-DD" day) pair. */
export async function upsertWorkDaySource(
    userId: string,
    date: string,
    source: SourceKind
): Promise<void> {
    await WorkDaySource.updateOne({ userId, date }, { $set: { source } }, {
        upsert: true,
    });
}

/** Day-source row for a single (user, day) pair, or null. */
export async function findWorkDaySource(
    userId: string,
    date: string
): Promise<WorkDaySourceRow | null> {
    return (await WorkDaySource.findOne({ userId, date })) as unknown as
        | WorkDaySourceRow
        | null;
}

export type WorkDaySourceRow = {
    _id: unknown;
    userId: string;
    date: string;
    source: SourceKind;
};

/**
 * Day-source rows for the given local day keys, optionally scoped to users
 * (string ObjectIds). Callers key them by `${userId}:${date}`.
 */
export const findWorkDaySources = (dateKeys: string[], userIds?: string[]) => {
    const filter = {
        date: { $in: dateKeys },
        ...(userIds ? { userId: { $in: userIds } } : {}),
    };
    return WorkDaySource.find(filter).lean() as unknown as Promise<
        WorkDaySourceRow[]
    >;
};
