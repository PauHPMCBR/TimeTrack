import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { authenticateToken, AuthRequest } from '@/lib/auth';
import { YearlyVacationDays } from '@/models';
import {
    responseErrorGet,
    responseErrorMethodNotAllowed,
} from '@/lib/response-error-generator';

// Years that have a company-wide vacation plan (global template rows).
async function handler(req: AuthRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return responseErrorMethodNotAllowed(res);
    }

    try {
        await dbConnect();
        const years = (await YearlyVacationDays.distinct('year', {
            userId: { $exists: false },
        })) as number[];

        res.status(200).json({
            success: true,
            data: { years: years.sort((a, b) => b - a) },
        });
    } catch (error) {
        console.error('Get vacation years error:', error);
        return responseErrorGet(res);
    }
}

export default authenticateToken(handler);
