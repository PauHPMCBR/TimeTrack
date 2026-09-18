import { withApi } from '@/lib/api-handler';
import { findActiveInRange } from '@/repositories/work-session-repository';
import { WorkSessionRangeQuerySchema } from 'shared/src/schemas/api';
import { dayRange } from '@/lib/date-range';

// Flat list of a user's work sessions within an inclusive date range
// (company-zone day bounds). Lighter than fetching N monthly records for
// range views such as the history page.
export default withApi(
    {
        method: 'GET',
        guard: 'selfOrAdmin',
        query: WorkSessionRangeQuerySchema,
    },
    async (req, res, { query }) => {
        const { userId, from, to } = query;

        const sessions = await findActiveInRange(
            dayRange(from).start,
            dayRange(to).end,
            {
                userId,
            }
        )
            .sort({ timestamp: 1 })
            .lean();

        res.status(200).json({
            success: true,
            data: { workSessions: sessions },
        });
    }
);
