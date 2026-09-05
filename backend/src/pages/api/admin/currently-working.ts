import { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { AuthRequest, requireRole } from '@/lib/auth';
import { ADMIN_ROLE, CHECK_IN, SESSION_REPLACED } from 'shared/src/lib/constants';
import { WorkSession, User } from '@/models';
import { startOfDay } from '@/lib/date-range';
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

        const today = startOfDay(new Date());

        const latestSessions = await WorkSession.aggregate([
            {
                $match: {
                    timestamp: { $gte: today },
                    status: { $ne: SESSION_REPLACED },
                },
            },
            {
                $sort: { timestamp: -1 },
            },
            {
                $group: {
                    _id: '$userId',
                    latestSession: { $first: '$$ROOT' },
                },
            },
        ]);

        const activeUserIds = latestSessions
            .filter((s) => s.latestSession.type === CHECK_IN)
            .map((s) => s._id);

        const activeUsers = await User.find(
            {
                _id: { $in: activeUserIds },
                blocked: { $ne: true },
                registered: true,
                deleted: { $ne: true },
            },
            'name email'
        ).lean();

        res.status(200).json({
            success: true,
            data: {
                count: activeUsers.length,
                users: activeUsers,
            },
        });
    } catch (error) {
        console.error('Currently working error:', error);
        return responseErrorGet(res);
    }
}

export default requireRole([ADMIN_ROLE], handler);
