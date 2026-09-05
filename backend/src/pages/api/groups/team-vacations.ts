import { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { AuthRequest, authenticateToken } from '@/lib/auth';
import { User, Group, ElectiveVacation } from '@/models';
import { UserRow, GroupRow } from '@/lib/rows';
import { resolveVacationNames } from '@/lib/vacation-names';
import {
    responseErrorGet,
    responseErrorMethodNotAllowed,
} from '@/lib/response-error-generator';
import { VACATION_APPROVED, VACATION_PENDING } from 'shared/src/lib/constants';

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

        // Exclude blocked/unregistered/deleted members.
        const activeMembers = memberIds.size
            ? ((await User.find(
                  {
                      _id: { $in: Array.from(memberIds) },
                      blocked: { $ne: true },
                      registered: true,
                      deleted: { $ne: true },
                  },
                  '_id'
              ).lean()) as unknown as { _id: string }[])
            : [];
        const activeMemberIds = activeMembers.map((m) => m._id.toString());

        const vacations = await ElectiveVacation.find({
            userId: { $in: activeMemberIds },
            // Intervals overlapping the requested year. Pending requests are
            // included so group mates can see upcoming time off that is not
            // confirmed yet (the calendar marks them distinctly).
            startDate: { $lte: endDate },
            endDate: { $gte: startDate },
            status: { $in: [VACATION_APPROVED, VACATION_PENDING] },
        })
            .sort({ startDate: 1 })
            .lean();

        // Resolve the vacation owner (userId → { _id, name, email }) and the
        // approving admin (approvedByName) so the calendar can display them.
        const resolved = await resolveVacationNames(vacations, {
            populateUserId: true,
        });

        res.status(200).json({ success: true, data: { vacations: resolved } });
    } catch (error) {
        console.error('Get team vacations error:', error);
        return responseErrorGet(res);
    }
}

export default authenticateToken(handler);
