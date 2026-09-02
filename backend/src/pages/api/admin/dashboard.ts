import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { AuthRequest, requireRole } from '@/lib/auth';
import {
    ADMIN_ROLE,
    CHECK_IN,
    SESSION_REPLACED,
    VACATION_PENDING,
} from 'shared/src/lib/constants';
import { User, Group, WorkSession, ElectiveVacation } from '@/models';
import { getAppSettings } from '@/lib/settings';
import { computeDayHours } from 'shared/src/lib/work-hours';
import { dateKey } from '@/lib/date-key';
import { startOfDay } from '@/lib/date-range';
import { UserRow, GroupRow, WorkSessionRow } from '@/lib/rows';
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

        const users = (await User.find(
            { role: { $ne: ADMIN_ROLE } },
            'name email dni role registered blocked groups expectedWorkHours workDays avatar blockedSince'
        )
            .sort({ name: 1 })
            .lean()) as unknown as UserRow[];

        // Active employees = registered and not blocked. These are the ones
        // used for operational counts (anomalies / currently working); the
        // full list (incl. blocked/unregistered) is still returned so the
        // admin users panel can see and manage every account.
        const activeUsers = users.filter(
            (u) => u.registered && !u.blocked
        );

        const groups = (await Group.find({})
            .sort({ name: 1 })
            .lean()) as unknown as GroupRow[];

        const today = startOfDay(new Date());

        const [pendingVacations, latestSessions, settings] = await Promise.all([
            ElectiveVacation.countDocuments({ status: VACATION_PENDING }),
            WorkSession.aggregate([
                {
                    $match: {
                        timestamp: { $gte: today },
                        status: { $ne: SESSION_REPLACED },
                    },
                },
                { $sort: { timestamp: -1 } },
                { $group: { _id: '$userId', latest: { $first: '$$ROOT' } } },
            ]),
            getAppSettings(),
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

        const weekSessions = (await WorkSession.find({
            timestamp: { $gte: monday, $lte: weekEnd },
            status: { $ne: SESSION_REPLACED },
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
            const nonWorkingDays =
                Array.isArray(user.workDays) && user.workDays.length > 0
                    ? user.workDays
                    : settings.nonWorkingDays;
            for (let i = 0; i < 7; i++) {
                const day = new Date(monday);
                day.setDate(monday.getDate() + i);
                if (nonWorkingDays.includes(day.getDay())) continue;
                const userSessions =
                    sessionsByUserDay.get(`${user._id}:${dateKey(day)}`) ?? [];
                const expectedHours =
                    user.expectedWorkHours ?? settings.defaultExpectedHours;
                const { totalHours, anomalies } = computeDayHours(userSessions);
                const anomalySet = new Set(anomalies);
                if (totalHours === 0) anomalySet.add('hours_short');
                else if (!(
                    totalHours >= expectedHours - settings.toleranceHours &&
                    totalHours <= expectedHours + settings.toleranceHours
                )) {
                    anomalySet.add(
                        totalHours < expectedHours
                            ? 'hours_short'
                            : 'hours_over'
                    );
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
                    expectedWorkHours: u.expectedWorkHours,
                    workDays: u.workDays,
                    avatar: u.avatar,
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

export default requireRole([ADMIN_ROLE], handler);
