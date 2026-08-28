import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { AuthRequest, authenticateToken } from '@/lib/auth';
import { MonthlyApproval } from '@/models';
import {
    responseErrorEntryNotFound,
    responseErrorIllegalAction,
    responseErrorMethodNotAllowed,
    responseErrorPost,
} from '@/lib/response-error-generator';
import { APPROVAL_APPROVED } from 'shared/src/lib/constants';

// The worker confirms their monthly record. Owner-only on purpose: nobody can
// confirm a month on behalf of a worker (the confirmation is the worker's
// signature on the record, per the registro de jornada requirements).
async function handler(req: AuthRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return responseErrorMethodNotAllowed(res);
    }

    try {
        await dbConnect();
        const approvalId = req.query.approvalId as string;

        const approval = await MonthlyApproval.findById(approvalId);
        if (!approval) {
            return responseErrorEntryNotFound(res, 'MonthlyApproval');
        }

        if (approval.userId.toString() !== req.user!.userId) {
            return responseErrorIllegalAction(res, 'ModifyingFromAnotherUser');
        }

        if (approval.status === APPROVAL_APPROVED) {
            return responseErrorIllegalAction(res, 'MonthAlreadyApproved');
        }

        approval.status = APPROVAL_APPROVED;
        approval.approvedAt = new Date();
        await approval.save();

        res.status(200).json({
            success: true,
            data: { approval },
        });
    } catch (error) {
        console.error('Approve monthly record error:', error);
        return responseErrorPost(res);
    }
}

export default authenticateToken(handler);
