import { AuthorizedLeave } from '@/models';
import type { DateKey } from 'shared/src/lib/day-key';

export const findLeavesOverlapping = (
    startKey: DateKey,
    endKey: DateKey,
    options: { userId?: string | { $in: string[] } } = {}
) =>
    AuthorizedLeave.find({
        startDate: { $lte: endKey },
        endDate: { $gte: startKey },
        ...(options.userId !== undefined ? { userId: options.userId } : {}),
    });
