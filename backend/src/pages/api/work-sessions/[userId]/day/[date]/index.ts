import { withApi } from '@/lib/api-handler';
import { findActiveInRange } from '@/repositories/work-session-repository';
import { DateParamSchema } from 'shared/src/schemas/api';
import { dayRange } from '@/lib/date-range';

export default withApi(
    { method: 'GET', guard: 'selfOrAdmin', query: DateParamSchema },
    async (_req, res, { query }) => {
        const userId = query.userId;
        // Build the day bucket from the raw "YYYY-MM-DD" string so it matches
        // the local calendar day regardless of the server timezone (parsing
        // with `new Date()` would resolve to UTC midnight and shift the day).
        const { start, end } = dayRange(query.date);

        const sessions = await findActiveInRange(start, end, { userId })
            .sort({ timestamp: 1 })
            .lean();

        res.status(200).json({
            success: true,
            data: { workSessions: sessions },
        });
    }
);
