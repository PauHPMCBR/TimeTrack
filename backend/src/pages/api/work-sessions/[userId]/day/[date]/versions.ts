import { withApi } from '@/lib/api-handler';
import { WorkSession } from '@/models';
import { DateParamSchema } from 'shared/src/schemas/api';
import { dayRange } from '@/lib/date-range';

// Full version history of a day's work sessions: the current (active) version
// plus every superseded version, sorted by version then timestamp. This is the
// audit view for the registro de jornada — regular readers only ever surface
// the active version, while replaced ones are kept for traceability.
export default withApi(
    { method: 'GET', guard: 'selfOrAdmin', query: DateParamSchema },
    async (_req, res, { query }) => {
        // Build the day bucket from the raw "YYYY-MM-DD" string so it matches
        // the local calendar day regardless of the server timezone (parsing
        // with `new Date()` would resolve to UTC midnight and shift the day).
        const { start, end } = dayRange(query.date);

        const versions = await WorkSession.find({
            userId: query.userId,
            timestamp: { $gte: start, $lt: end },
        })
            .sort({ version: 1, timestamp: 1 })
            .lean();

        res.status(200).json({
            success: true,
            data: { workSessions: versions },
        });
    }
);
