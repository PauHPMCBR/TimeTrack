import type { ClientSession } from 'mongoose';
import { WorkSession } from '@/models';
import { SESSION_REPLACED } from 'shared/src/lib/constants';

// Rows with the live status; SESSION_REPLACED rows are edit-history only and
// must never appear in computations or listings. Usable inside aggregate
// $match stages too.
export const notReplaced = { status: { $ne: SESSION_REPLACED } } as const;

// Active sessions in a timestamp range. `userId` scopes to one user;
// `endInclusive` switches the upper bound from $lt (day/month windows) to
// $lte (arbitrary date ranges). Returns the query so callers can chain
// select/sort/lean.
export const findActiveInRange = (
    start: Date,
    end: Date,
    options: {
        userId?: string;
        endInclusive?: boolean;
        session?: ClientSession;
    } = {}
) => {
    const filter = {
        ...(options.userId ? { userId: options.userId } : {}),
        timestamp: options.endInclusive
            ? { $gte: start, $lte: end }
            : { $gte: start, $lt: end },
        ...notReplaced,
    };
    if (options.session) {
        return WorkSession.find(filter, undefined, {
            session: options.session,
        });
    }
    return WorkSession.find(filter);
};
