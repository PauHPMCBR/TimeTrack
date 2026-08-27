import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { requireSameGroupOrAdmin, AuthRequest } from '@/lib/auth';
import { WorkSession } from '@/models';
import {
    responseErrorGet,
    responseErrorMethodNotAllowed,
} from '@/lib/response-error-generator';
import { DateParamSchema } from 'shared/src/schemas/api';
import { validateQueryParams } from '@/lib/validation';

async function handler(req: AuthRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return responseErrorMethodNotAllowed(res);
    }

    const validationMiddleware = validateQueryParams(DateParamSchema);
    await new Promise((resolve) => {
        validationMiddleware(req, res, () => resolve(true));
    });
    if (res.headersSent) return;

    try {
        await dbConnect();
        const userId = req.query.userId as string;
        // The query param is coerced to a Date (UTC instant). Re-derive the local
        // calendar date so the day bucket is the same wall-clock day the client
        // asked for, regardless of how the date was serialized.
        const parsed = new Date(req.query.date as string);
        const startOfDay = new Date(
            parsed.getFullYear(),
            parsed.getMonth(),
            parsed.getDate(),
            0,
            0,
            0,
            0
        );
        const endOfDay = new Date(
            parsed.getFullYear(),
            parsed.getMonth(),
            parsed.getDate(),
            23,
            59,
            59,
            999
        );

        const sessions = await WorkSession.find({
            userId: userId,
            timestamp: { $gte: startOfDay, $lte: endOfDay },
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
