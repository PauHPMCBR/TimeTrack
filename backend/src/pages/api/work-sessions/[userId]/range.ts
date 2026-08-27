import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { requireSameGroupOrAdmin, AuthRequest } from '@/lib/auth';
import { WorkSession } from '@/models';
import {
    responseErrorGet,
    responseErrorIncorrectParameter,
    responseErrorMethodNotAllowed,
} from '@/lib/response-error-generator';
import { validateQueryParams } from '@/lib/validation';
import { WorkSessionRangeQuerySchema } from 'shared/src/schemas/api';

// Flat list of a user's work sessions within an inclusive date range (local
// day bounds). Lighter than fetching N monthly records for range views such as
// the history page.
async function handler(req: AuthRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return responseErrorMethodNotAllowed(res);
    }

    const validationMiddleware = validateQueryParams(
        WorkSessionRangeQuerySchema
    );
    await new Promise((resolve) => {
        validationMiddleware(req, res, () => resolve(true));
    });
    if (res.headersSent) return;

    try {
        await dbConnect();
        const userId = req.query.userId as string;
        const from = req.query.from as string;
        const to = req.query.to as string;

        const fromDate = new Date(`${from}T00:00:00`);
        const toDate = new Date(`${to}T23:59:59.999`);
        if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
            return responseErrorIncorrectParameter(res, 'date', [
                'InvalidTimestamp',
            ]);
        }

        const sessions = await WorkSession.find({
            userId: userId,
            timestamp: { $gte: fromDate, $lte: toDate },
        })
            .sort({ timestamp: 1 })
            .lean();

        res.status(200).json({
            success: true,
            data: { workSessions: sessions },
        });
    } catch (error) {
        console.error('Get user range sessions error:', error);
        return responseErrorGet(res);
    }
}

export default requireSameGroupOrAdmin(handler);
