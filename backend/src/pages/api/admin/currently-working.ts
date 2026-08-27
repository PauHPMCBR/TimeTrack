import { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { AuthRequest, requireRole } from '@/lib/auth';
import { WorkSession, User } from '@/models';
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

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const latestSessions = await WorkSession.aggregate([
            {
                $match: {
                    timestamp: { $gte: today },
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
            .filter((s) => s.latestSession.type === 'check_in')
            .map((s) => s._id);

        const activeUsers = await User.find(
            { _id: { $in: activeUserIds } },
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

export default requireRole(['admin'], handler);
