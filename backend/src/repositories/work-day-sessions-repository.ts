import type { ClientSession } from 'mongoose';
import { WorkDaySessions } from '@/models';
import { SESSION_REPLACED } from 'shared/src/lib/constants';
import type { DateKey } from 'shared/src/lib/day-key';

// Docs with the live status; 'replaced' day versions are edit-history only and
// must never appear in computations or listings. Usable inside aggregate
// $match stages too.
export const notReplaced = { status: { $ne: SESSION_REPLACED } } as const;

// Active day documents whose company-zone day (`date`, "YYYY-MM-DD") falls
// within the given inclusive day range. Lexicographic key comparison: no
// time-zone math involved. `userId` scopes to one user.
export const findActiveDaySessions = (
    from: DateKey,
    to: DateKey,
    options: {
        userId?: string | { $in: string[] };
        session?: ClientSession;
    } = {}
) => {
    const filter = {
        ...(options.userId !== undefined ? { userId: options.userId } : {}),
        date: { $gte: from, $lte: to },
        ...notReplaced,
    };
    if (options.session) {
        return WorkDaySessions.find(filter, undefined, {
            session: options.session,
        });
    }
    return WorkDaySessions.find(filter);
};

// The active version of a single (user, day) — null when the day has no data.
export const findActiveDay = (
    userId: string,
    date: DateKey,
    options: { session?: ClientSession } = {}
) =>
    WorkDaySessions.findOne(
        { userId, date, ...notReplaced },
        undefined,
        options.session ? { session: options.session } : undefined
    );

// Full version history of a (user, day): the active version plus every
// superseded one, ascending.
export const findDayVersions = (userId: string, date: DateKey) =>
    WorkDaySessions.find({ userId, date }).sort({ version: 1 });

// Every version (active and replaced) of the day documents in an inclusive
// day range, optionally scoped to a set of users. Used by the export's edit
// history so corrections stay visible.
export const findDayVersionRange = (
    from: DateKey,
    to: DateKey,
    options: { userId?: string | { $in: string[] } } = {}
) =>
    WorkDaySessions.find({
        ...(options.userId !== undefined ? { userId: options.userId } : {}),
        date: { $gte: from, $lte: to },
    }).sort({ date: 1, version: 1 });
