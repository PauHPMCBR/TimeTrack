import { withApi } from '@/lib/api-handler';
import { findActiveDaySessions } from '@/repositories/work-day-sessions-repository';
import { WorkSessionRangeQuerySchema } from 'shared/src/schemas/api';

// Flat list of a user's work sessions within an inclusive date range
// (company-zone day keys), one entry per day with data. Lighter than fetching
// N monthly records for range views such as the history page.
export default withApi(
    {
        method: 'GET',
        guard: 'selfOrAdmin',
        query: WorkSessionRangeQuerySchema,
    },
    async (req, res, { query }) => {
        const { userId, from, to } = query;

        const daySessions = await findActiveDaySessions(from, to, {
            userId,
        })
            .sort({ date: 1 })
            .lean();

        res.status(200).json({
            success: true,
            data: { daySessions },
        });
    }
);
