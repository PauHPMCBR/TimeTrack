import { withApi } from '@/lib/api-handler';
import { findDayVersions } from '@/repositories/work-day-sessions-repository';
import { DateParamSchema } from 'shared/src/schemas/api';

// Full version history of a day's sessions: the current (active) version plus
// every superseded one, ascending by version. This is the audit view for the
// registro de jornada — regular readers only ever surface the active version,
// while replaced ones are kept for traceability.
export default withApi(
    { method: 'GET', guard: 'selfOrAdmin', query: DateParamSchema },
    async (_req, res, { query }) => {
        const versions = await findDayVersions(query.userId, query.date).lean();

        res.status(200).json({
            success: true,
            data: { workSessions: versions },
        });
    }
);
