import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { requireRole, AuthRequest } from '@/lib/auth';
import {
    ADMIN_ROLE,
    VACATION_APPROVED,
    VACATION_CANCELLED,
    VACATION_PENDING,
    VACATION_REJECTED,
} from 'shared/src/lib/constants';
import { ElectiveVacation } from '@/models';
import {
    responseErrorEntryNotFound,
    responseErrorIncorrectParameter,
    responseErrorMethodNotAllowed,
    responseErrorPost,
} from '@/lib/response-error-generator';

async function handler(req: AuthRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return responseErrorMethodNotAllowed(res);
    }

    try {
        await dbConnect();
        const vacationId = req.query.vacationId as string;
        const { status } = req.body;

        if (
            ![VACATION_PENDING, VACATION_APPROVED, VACATION_REJECTED, VACATION_CANCELLED].includes(
                status
            )
        ) {
            return responseErrorIncorrectParameter(res, 'status');
        }

        const updateData: {
            status: string;
            approvedBy?: string;
            approvedAt?: Date;
        } = { status };
        if (status === VACATION_APPROVED) {
            updateData.approvedBy = req.user?.userId;
            updateData.approvedAt = new Date();
        }

        // The spent-days balance is derived from the requests themselves, so
        // resolving only flips the status.
        const updated = await ElectiveVacation.findByIdAndUpdate(
            vacationId,
            updateData
        );

        if (!updated) {
            return responseErrorEntryNotFound(res, 'Vacation');
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Resolve vacation error:', error);
        return responseErrorPost(res);
    }
}

export default requireRole([ADMIN_ROLE], handler);
