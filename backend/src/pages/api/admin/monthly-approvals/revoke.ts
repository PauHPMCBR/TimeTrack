import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { AuthRequest, requireRole } from '@/lib/auth';
import { ADMIN_ROLE } from 'shared/src/lib/constants';
import { MonthlyApproval } from '@/models';
import {
    responseErrorEntryNotFound,
    responseErrorMethodNotAllowed,
    responseErrorPost,
} from '@/lib/response-error-generator';
import { runValidation, validateRequestBody } from '@/lib/validation';
import {
    MonthlyApprovalRevokeRequest,
    MonthlyApprovalRevokeRequestSchema,
} from 'shared/src/schemas/api';

// Revokes a monthly record confirmation (pending or approved), unlocking the
// month for edits. After editing, the admin must open the month again, which
// starts a new approval cycle for the worker.
async function handler(req: AuthRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return responseErrorMethodNotAllowed(res);
    }

    if (
        !(await runValidation(
            validateRequestBody(MonthlyApprovalRevokeRequestSchema),
            req,
            res
        ))
    )
        return;

    try {
        await dbConnect();
        const { userId, year, month } =
            req.body as MonthlyApprovalRevokeRequest;

        const result = await MonthlyApproval.deleteOne({ userId, year, month });
        if (result.deletedCount === 0) {
            return responseErrorEntryNotFound(res, 'MonthlyApproval');
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Revoke monthly approval error:', error);
        return responseErrorPost(res);
    }
}

export default requireRole([ADMIN_ROLE], handler);
