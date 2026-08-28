import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { requireSameGroupOrAdmin, AuthRequest } from '@/lib/auth';
import { WorkSession } from '@/models';
import {
    responseErrorGet,
    responseErrorMethodNotAllowed,
} from '@/lib/response-error-generator';
import { DateParamSchema } from 'shared/src/schemas/api';
import { runValidation, validateQueryParams } from '@/lib/validation';
import { dayRange } from '@/lib/date-range';

// Full version history of a day's work sessions: the current (active) version
// plus every superseded version, sorted by version then timestamp. This is the
// audit view for the registro de jornada — regular readers only ever surface
// the active version, while replaced ones are kept for traceability.
async function handler(req: AuthRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return responseErrorMethodNotAllowed(res);
    }

    if (!(await runValidation(validateQueryParams(DateParamSchema), req, res)))
        return;

    try {
        await dbConnect();
        const userId = req.query.userId as string;
        // Build the day bucket from the raw "YYYY-MM-DD" string so it matches
        // the local calendar day regardless of the server timezone (parsing
        // with `new Date()` would resolve to UTC midnight and shift the day).
        const { start, end } = dayRange(req.query.date as string);

        const versions = await WorkSession.find({
            userId: userId,
            timestamp: { $gte: start, $lt: end },
        })
            .sort({ version: 1, timestamp: 1 })
            .lean();

        res.status(200).json({
            success: true,
            data: { workSessions: versions },
        });
    } catch (error) {
        console.error('Get user day session versions error:', error);
        return responseErrorGet(res);
    }
}

export default requireSameGroupOrAdmin(handler);
