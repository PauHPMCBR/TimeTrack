import { withApi } from '@/lib/api-handler';
import { findActiveDay } from '@/repositories/work-day-sessions-repository';
import { DateParamSchema } from 'shared/src/schemas/api';
import type { DaySessionsRow } from '@/lib/rows';

export default withApi(
    { method: 'GET', guard: 'selfOrAdmin', query: DateParamSchema },
    async (_req, res, { query }) => {
        const userId = query.userId;

        const day = await findActiveDay(userId, query.date).lean<
            Pick<DaySessionsRow, 'sessions'> | null
        >();

        res.status(200).json({
            success: true,
            data: { workSessions: day?.sessions ?? [] },
        });
    }
);
