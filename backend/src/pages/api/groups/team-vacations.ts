import { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { AuthRequest, authenticateToken } from '@/lib/auth';
import { User, Group, ElectiveVacation } from '@/models';
import { UserRow, GroupRow } from '@/lib/rows';
import {
    responseErrorGet,
    responseErrorMethodNotAllowed,
} from '@/lib/response-error-generator';
import { VACATION_APPROVED } from 'shared/src/lib/constants';

async function handler(req: AuthRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return responseErrorMethodNotAllowed(res);
    }

    try {
        await dbConnect();
        const userId = req.user?.userId;
        const year = parseInt(req.query.year as string);

        if (!year) {
            return res.status(400).json({ error: 'YearRequired' });
        }

        const currentUser = (await User.findById(
            userId
        ).lean()) as unknown as UserRow | null;
        if (!currentUser) {
            return res.status(404).json({ error: 'UserNotFound' });
        }

        const groups = (await Group.find({
            _id: { $in: currentUser.groups },
        }).lean()) as unknown as GroupRow[];
        const memberIds = new Set<string>();
        groups.forEach((g) => {
            g.members.forEach((m) => memberIds.add(m.toString()));
        });

        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 11, 31, 23, 59, 59, 999);

        const vacations = await ElectiveVacation.find({
            userId: { $in: Array.from(memberIds) },
            date: { $gte: startDate, $lte: endDate },
            status: VACATION_APPROVED,
        })
            .populate('userId', 'name email')
            .lean();

        res.status(200).json({ success: true, data: { vacations } });
    } catch (error) {
        console.error('Get team vacations error:', error);
        return responseErrorGet(res);
    }
}

export default authenticateToken(handler);
