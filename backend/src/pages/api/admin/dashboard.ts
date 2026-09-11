import { withApi } from '@/lib/api-handler';
import {
    APPROVAL_PENDING,
    CHECK_IN,
    VACATION_PENDING,
} from 'shared/src/lib/constants';
import { User, Group, WorkSession, ElectiveVacation, MonthlyApproval } from '@/models';
import {
    findActiveInRange,
    notReplaced,
} from '@/repositories/work-session-repository';
import { notDeleted } from '@/repositories/user-repository';
import { getAppSettings } from '@/lib/settings';
import { computeDayHours, isWithinTolerance } from 'shared/src/lib/work-hours';
import {
    computeTimetableAnomalies,
    dayTimetable,
    impliedHours,
} from 'shared/src/lib/expected-timetable';
import { defaultTimetable, WeekTimetable } from 'shared/src/schemas/database';
import { dateKey } from '@/lib/date-key';
import { startOfDay } from '@/lib/date-range';
import {
    resolveWeeklyExpectedHours,
} from 'shared/src/lib/user-overrides';
import { UserRow, GroupRow, WorkSessionRow } from '@/lib/rows';
import { responseErrorGet } from '@/lib/response-error-generator';

export default withApi(
    { method: 'GET', guard: 'admin' },
    async (_req, res) => {
        try {
            const users = (await User.find(
                notDeleted,
                'name email emailEncrypted dni dniEncrypted role registered blocked groups weeklyExpectedHours scheduleMode timetable avatar blockedSince trackingStartDate checkInRequired'
            )
                .sort({ name: 1 })
                .lean()) as unknown as UserRow[];

        // Active employees = registered, not blocked, and required to check in.
        // These are the ones used for operational counts (anomalies / currently
        // working); the full list (incl. blocked/unregistered/admins) is still
        // returned so the admin users panel can see and manage every account.
        const activeUsers = users.filter(
            (u) => u.registered && !u.blocked && u.checkInRequired !== false
        );

        const groups = (await Group.find({})
            .sort({ name: 1 })
            .lean()) as unknown as GroupRow[];

        const today = startOfDay(new Date());

        const [pendingVacations, latestSessions, settings, pendingApprovals] =
            await Promise.all([
                ElectiveVacation.countDocuments({ status: VACATION_PENDING }),
                WorkSession.aggregate([
                    {
                        $match: {
                            timestamp: { $gte: today },
                            ...notReplaced,
                        },
                    },
                    { $sort: { timestamp: -1 } },
                    { $group: { _id: '$userId', latest: { $first: '$$ROOT' } } },
                ]),
                getAppSettings(),
                MonthlyApproval.countDocuments({ status: APPROVAL_PENDING }),
            ]);

        const workingUserIds = new Set(
            latestSessions
                .filter((s) => s.latest.type === CHECK_IN)
                .map((s) => s._id)
        );

        // Current week (Mon..Sun) sessions for the anomaly count.
        const diffToMonday = (today.getDay() + 6) % 7;
        const monday = new Date(today);
        monday.setDate(monday.getDate() - diffToMonday);
        const weekEnd = new Date(monday);
        weekEnd.setDate(monday.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        const weekSessions = (await findActiveInRange(monday, weekEnd, {
            endInclusive: true,
        })
            .sort({ timestamp: 1 })
            .lean()) as unknown as WorkSessionRow[];
        const sessionsByUserDay = new Map<string, WorkSessionRow[]>();
        for (const s of weekSessions) {
            const key = `${s.userId}:${dateKey(new Date(s.timestamp))}`;
            const list = sessionsByUserDay.get(key) ?? [];
            list.push(s);
            sessionsByUserDay.set(key, list);
        }

        let anomalyCount = 0;
        for (const user of activeUsers) {
            const isTimetableMode = user.scheduleMode === 'timetable';
            const weekTimetable: WeekTimetable =
                user.timetable ?? defaultTimetable();
            const weeklyHours = isTimetableMode
                ? null
                : resolveWeeklyExpectedHours(user, settings.defaultWeeklyExpectedHours);
            for (let i = 0; i < 7; i++) {
                const day = new Date(monday);
                day.setDate(monday.getDate() + i);
                const dow = day.getDay();
                const intervals = dayTimetable(weekTimetable, dow);
                const expectedHours = isTimetableMode
                    ? impliedHours(intervals)
                    : (weeklyHours?.[dow] ?? 0);
                const isNonWorkingDay = isTimetableMode
                    ? intervals.length === 0
                    : expectedHours === 0;
                if (isNonWorkingDay) continue;
                const userSessions =
                    sessionsByUserDay.get(`${user._id}:${dateKey(day)}`) ?? [];
                const { totalHours, overtimeHours, anomalies } =
                    computeDayHours(userSessions);
                const anomalySet = new Set(anomalies);
                if (isTimetableMode) {
                    for (const anomaly of computeTimetableAnomalies(
                        userSessions,
                        intervals,
                        settings.timetableToleranceMinutes
                    )) {
                        anomalySet.add(anomaly);
                    }
                } else {
                    const regularHours = totalHours - overtimeHours;
                    if (regularHours === 0) {
                        anomalySet.add('hours_short');
                    } else if (!isWithinTolerance(
                        regularHours,
                        expectedHours,
                        settings.toleranceMinutes
                    )) {
                        anomalySet.add(
                            regularHours < expectedHours
                                ? 'hours_short'
                                : 'hours_over'
                        );
                    }
                }
                if (anomalySet.size > 0) anomalyCount++;
            }
        }

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
