import { withApi } from '@/lib/api-handler';
import {
    APPROVAL_PENDING,
    VACATION_PENDING,
} from 'shared/src/lib/constants';
import { openCheckIn } from 'shared/src/lib/work-hours';
import { User, Group, WorkDaySessions, ElectiveVacation, MonthlyApproval, WorkDayRecord } from '@/models';
import {
    notReplaced,
} from '@/repositories/work-day-sessions-repository';
import { notDeleted } from '@/repositories/user-repository';
import { dateKey } from '@/lib/date-key';
import {
    dowFromDateKey,
    addDaysToKey,
} from 'shared/src/lib/day-key';
import { UserRow, GroupRow, DaySessionsRow, WorkDayRecordRow } from '@/lib/rows';
import { responseErrorGet } from '@/lib/response-error-generator';

export default withApi(
    { method: 'GET', guard: 'admin' },
    async (_req, res) => {
        try {
            const users = await User.find(
                notDeleted,
                'name email emailEncrypted dni dniEncrypted role registered blocked groups weeklyExpectedHours scheduleMode timetable avatar blockedSince trackingStartDate checkInRequired'
            )
                .sort({ name: 1 })
                .lean<UserRow[]>();

        // Active employees = registered, not blocked, and required to check in.
        // These are the ones used for operational counts (anomalies / currently
        // working); the full list (incl. blocked/unregistered/admins) is still
        // returned so the admin users panel can see and manage every account.
        const activeUsers = users.filter(
            (u) => u.registered && !u.blocked && u.checkInRequired !== false
        );

        const groups = await Group.find({})
            .sort({ name: 1 })
            .lean<GroupRow[]>();

        const todayKey = dateKey(new Date());

        const [pendingVacations, latestSessions, pendingApprovals] =
            await Promise.all([
                ElectiveVacation.countDocuments({ status: VACATION_PENDING }),
                WorkDaySessions.aggregate<{
                    _id: string;
                    latest: DaySessionsRow;
                }>([
                    {
                        $match: {
                            date: todayKey,
                            ...notReplaced,
                        },
                    },
                    { $group: { _id: '$userId', latest: { $first: '$$ROOT' } } },
                ]),
                MonthlyApproval.countDocuments({ status: APPROVAL_PENDING }),
            ]);

        const workingUserIds = new Set(
            latestSessions
                .filter((s) => openCheckIn(s.latest.sessions) !== null)
                .map((s) => s._id)
        );

        // Current week (Mon..Sun) anomaly count from the cached records.
        const diffToMonday = (dowFromDateKey(todayKey) + 6) % 7;
        const mondayKey = addDaysToKey(todayKey, -diffToMonday);
        const weekDays = Array.from({ length: 7 }, (_, i) =>
            addDaysToKey(mondayKey, i)
        );

        const weekRecords = await WorkDayRecord.find({
            date: { $gte: mondayKey, $lte: weekDays[6] },
            anomalies: { $exists: true, $not: { $size: 0 } },
        }).lean<Pick<WorkDayRecordRow, 'userId'>[]>();
        const activeUserIds = new Set(activeUsers.map((u) => u._id.toString()));
        const anomalyCount = weekRecords.filter((r) =>
            activeUserIds.has(r.userId)
        ).length;

        res.status(200).json({
            success: true,
            data: {
                users: users.map((u) => ({
                    _id: u._id.toString(),
                    name: u.name,
                    email: u.email,
                    dni: u.dni,
                    role: u.role,
                    registered: u.registered,
                    blocked: u.blocked,
                    blockedSince: u.blockedSince,
                    groups: u.groups,
                    avatar: u.avatar,
                    weeklyExpectedHours: u.weeklyExpectedHours,
                    scheduleMode: u.scheduleMode,
                    timetable: u.timetable,
                    trackingStartDate: u.trackingStartDate,
                    checkInRequired: u.checkInRequired,
                    workingNow: workingUserIds.has(u._id.toString()),
                })),
                groups: groups.map((g) => ({
                    _id: g._id.toString(),
                    name: g.name,
                    description: g.description,
                    members: g.members,
                })),
                usersCount: users.length,
                groupsCount: groups.length,
                pendingVacations,
                pendingApprovals,
                currentlyWorking: activeUsers.filter((u) =>
                    workingUserIds.has(u._id.toString())
                ).length,
                anomalyCount,
            },
        });
        } catch (error) {
            console.error('Admin dashboard error:', error);
            return responseErrorGet(res);
        }
    }
);
