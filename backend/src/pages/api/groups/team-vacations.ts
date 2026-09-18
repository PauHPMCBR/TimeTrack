import { withApi } from '@/lib/api-handler';
import { User, Group } from '@/models';
import { findOverlapping } from '@/repositories/vacation-repository';
import { findLeavesOverlapping } from '@/repositories/authorized-leave-repository';
import { UserRow, GroupRow, AuthorizedLeaveRow } from '@/lib/rows';
import { resolveVacationNames } from '@/lib/vacation-names';
import { responseErrorGet } from '@/lib/response-error-generator';
import { VACATION_APPROVED, VACATION_PENDING } from 'shared/src/lib/constants';
import type { DateKey } from 'shared/src/lib/day-key';

export default withApi({ method: 'GET' }, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const year = parseInt(String(req.query.year));

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

        const yearStart = `${year}-01-01` as DateKey;
        const yearEnd = `${year}-12-31` as DateKey;

        // Exclude blocked/unregistered/deleted members.
        const activeMembers = memberIds.size
            ? ((await User.find(
                  {
                      _id: { $in: Array.from(memberIds) },
                      blocked: { $ne: true },
                      registered: true,
                      deleted: { $ne: true },
                  },
                  '_id name'
              ).lean()) as unknown as { _id: string; name: string }[])
            : [];
        const activeMemberIds = activeMembers.map((m) => m._id.toString());
        const memberNames = new Map(
            activeMembers.map((m) => [m._id.toString(), m.name])
        );

        const vacations = await findOverlapping(yearStart, yearEnd, {
            // Intervals overlapping the requested year. Pending requests are
            // included so group mates can see upcoming time off that is not
            // confirmed yet (the calendar marks them distinctly).
            userId: { $in: activeMemberIds },
            statuses: [VACATION_APPROVED, VACATION_PENDING],
        })
            .sort({ startDate: 1 })
            .lean();

        // Resolve the vacation owner (userId → { _id, name, email }) and the
        // approving admin (approvedByName) so the calendar can display them.
        const resolved = await resolveVacationNames(vacations, {
            populateUserId: true,
        });

        const leaves = (await findLeavesOverlapping(yearStart, yearEnd, {
            userId: { $in: activeMemberIds },
        }).lean()) as unknown as AuthorizedLeaveRow[];
        const resolvedLeaves = leaves.map((leave) => ({
            ...leave,
            userName: memberNames.get(leave.userId),
        }));

        res.status(200).json({
            success: true,
            data: { vacations: resolved, leaves: resolvedLeaves },
        });
    } catch (error) {
        console.error('Get team vacations error:', error);
        return responseErrorGet(res);
    }
});
