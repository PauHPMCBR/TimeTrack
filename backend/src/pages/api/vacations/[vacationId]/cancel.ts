import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { AuthRequest, authenticateToken } from '@/lib/auth';
import { ElectiveVacation } from '@/models';
import {
    responseErrorIllegalAction,
    responseErrorMethodNotAllowed,
    responseErrorPost,
} from '@/lib/response-error-generator';
import { VACATION_CANCELLED } from 'shared/src/lib/constants';

async function handler(req: AuthRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return responseErrorMethodNotAllowed(res);
    }

    try {
        await dbConnect();
        const vacationId = req.query.vacationId as string;
        const userId = req.user!.userId;

        const vacation = await ElectiveVacation.findById(vacationId);

        if (!vacation) {
            return responseErrorIllegalAction(res, 'ModifyingFromAnotherUser');
        }

        if (vacation.userId.toString() !== userId) {
            return responseErrorIllegalAction(res, 'ModifyingFromAnotherUser');
        }

        await ElectiveVacation.findByIdAndUpdate(vacationId, {
            status: VACATION_CANCELLED,
            updatedAt: new Date(),
        });

        res.status(201).json({ success: true });
    } catch (error) {
        console.error('Cancel elective vacation error:', error);
        return responseErrorPost(res);
    }
}

export default authenticateToken(handler);
