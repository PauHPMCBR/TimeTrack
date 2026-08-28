import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { requireSameGroupOrAdmin, AuthRequest } from '@/lib/auth';
import { MonthlyApproval } from '@/models';
import {
    responseErrorGet,
    responseErrorMethodNotAllowed,
} from '@/lib/response-error-generator';
import { MonthlyApprovalRow } from 'shared/src/schemas/api';

// The worker's monthly record confirmations: months opened for approval
// (pending) and months they already confirmed (approved).
async function handler(req: AuthRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return responseErrorMethodNotAllowed(res);
    }

    try {
        await dbConnect();
        const userId = req.query.userId as string;

        const approvals = (await MonthlyApproval.find({ userId })
            .sort({ year: -1, month: -1 })
            .lean()) as unknown as MonthlyApprovalRow[];

        res.status(200).json({
            success: true,
            data: { approvals },
        });
    } catch (error) {
        console.error('Get user monthly approvals error:', error);
        return responseErrorGet(res);
    }
}

export default requireSameGroupOrAdmin(handler);
