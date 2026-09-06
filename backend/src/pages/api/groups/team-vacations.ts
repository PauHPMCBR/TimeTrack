import { withApi } from '@/lib/api-handler';
import { yearRange } from 'shared/src/lib/date-ranges';
import { User, Group } from '@/models';
import { findOverlapping } from '@/repositories/vacation-repository';
import { UserRow, GroupRow } from '@/lib/rows';
import { resolveVacationNames } from '@/lib/vacation-names';
import { responseErrorGet } from '@/lib/response-error-generator';
import { VACATION_APPROVED, VACATION_PENDING } from 'shared/src/lib/constants';

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

        const { start: startDate, end: endDate } = yearRange(year);

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

        const vacations = await findOverlapping(startDate, endDate, {
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

        res.status(200).json({ success: true, data: { vacations: resolved } });
    } catch (error) {
        console.error('Get team vacations error:', error);
        return responseErrorGet(res);
    }
});
