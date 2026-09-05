import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { AuthRequest, requireRole } from '@/lib/auth';
import { ADMIN_ROLE, VACATION_PENDING } from 'shared/src/lib/constants';
import { ElectiveVacation, User } from '@/models';
import {
    responseErrorGet,
    responseErrorMethodNotAllowed,
} from '@/lib/response-error-generator';

async function handler(req: AuthRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return responseErrorMethodNotAllowed(res);
    }

    try {
        await dbConnect();

        const activeUsers = await User.find(
            { deleted: { $ne: true } },
            '_id'
        ).lean();
        const activeUserIds = activeUsers.map((u) => u._id);

        const vacations = await ElectiveVacation.find({
            status: VACATION_PENDING,
            userId: { $in: activeUserIds },
        })
            .sort({ startDate: 1 })
            .lean();

        res.status(200).json({ success: true, data: { vacations: vacations } });
    } catch (error) {
        console.error('Get pending vacations error:', error);
        return responseErrorGet(res);
    }
}

export default requireRole([ADMIN_ROLE], handler);
