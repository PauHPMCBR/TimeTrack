import { withApi } from '@/lib/api-handler';
import { findActiveInRange } from '@/repositories/work-session-repository';
import { responseErrorIncorrectParameter } from '@/lib/response-error-generator';
import { WorkSessionRangeQuerySchema } from 'shared/src/schemas/api';

// Flat list of a user's work sessions within an inclusive date range (local
// day bounds). Lighter than fetching N monthly records for range views such as
// the history page.
export default withApi(
    {
        method: 'GET',
        guard: 'selfOrAdmin',
        query: WorkSessionRangeQuerySchema,
    },
    async (req, res, { query }) => {
        const { userId, from, to } = query;

        const fromDate = new Date(`${from}T00:00:00`);
        const toDate = new Date(`${to}T23:59:59.999`);
        if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
            return responseErrorIncorrectParameter(res, 'date', [
                'InvalidTimestamp',
            ]);
        }

        const sessions = await findActiveInRange(fromDate, toDate, {
            userId,
            endInclusive: true,
        })
            .sort({ timestamp: 1 })
            .lean();

        res.status(200).json({
            success: true,
            data: { workSessions: sessions },
        });
    }
);
