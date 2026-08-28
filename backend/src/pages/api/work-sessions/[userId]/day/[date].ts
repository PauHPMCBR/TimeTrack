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

        const sessions = await WorkSession.find({
            userId: userId,
            timestamp: { $gte: start, $lt: end },
        })
            .sort({ timestamp: 1 })
            .lean();

        res.status(200).json({
            success: true,
            data: { workSessions: sessions },
        });
    } catch (error) {
        console.error('Get user day sessions error:', error);
        return responseErrorGet(res);
    }
}

export default requireSameGroupOrAdmin(handler);
