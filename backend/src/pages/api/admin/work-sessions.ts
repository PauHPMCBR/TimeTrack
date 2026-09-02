import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { requireRole, AuthRequest } from '@/lib/auth';
import {
    ADMIN_ROLE,
    SOURCE_ADMIN,
    SESSION_ACTIVE,
    SESSION_REPLACED,
    SESSION_REASON_ADMIN_CORRECTION,
    VACATION_APPROVED,
} from 'shared/src/lib/constants';
import { DEFAULT_EXPECTED_WORK_HOURS } from 'shared/src/lib/defaults';
import {
    User,
    WorkSession,
    ElectiveVacation,
    YearlyVacationDays,
} from '@/models';
import { getAppSettings } from '@/lib/settings';
import { runInTransaction } from '@/lib/transaction';
import {
    UserRow,
    WorkSessionRow,
    ElectiveVacationRow,
    YearlyVacationRow,
} from '@/lib/rows';
import {
    computeDayHours,
    isWithinBenevolence,
    isCoherentSequence,
} from 'shared/src/lib/work-hours';
import {
    responseErrorEntryNotFound,
    responseErrorGet,
    responseErrorIllegalAction,
    responseErrorIncorrectParameter,
    responseErrorMethodNotAllowed,
    responseErrorPut,
} from '@/lib/response-error-generator';
import {
    runValidation,
    validateQueryParams,
    validateRequestBody,
} from '@/lib/validation';
import {
    AdminWorkSessionsQueryWithPaginationSchema,
    AdminWorkSessionsQuery,
    AdminWorkSessionRow,
    AdminReplaceDayWorkSessionsRequest,
    AdminReplaceDayWorkSessionsRequestSchema,
    WorkSessionRowStatus,
} from 'shared/src/schemas/api';
import { dateKey } from '@/lib/date-key';
import { withUserLock } from '@/lib/user-lock';
import { isMonthApproved } from '@/lib/monthly-approvals';

async function handler(req: AuthRequest, res: NextApiResponse) {
    if (req.method === 'PUT') {
        if (
            !(await runValidation(
                validateRequestBody(AdminReplaceDayWorkSessionsRequestSchema),
                req,
                res
            ))
        )
            return;

        try {
            await dbConnect();
            const { userId, date, sessions, reason } =
                req.body as AdminReplaceDayWorkSessionsRequest;

            const user = await User.findById(userId);
            if (!user) {
                return responseErrorEntryNotFound(res, 'User');
            }

            const dayStart = new Date(`${date}T00:00:00`);
            const dayEnd = new Date(`${date}T23:59:59.999`);
            if (isNaN(dayStart.getTime()) || isNaN(dayEnd.getTime())) {
                return responseErrorIncorrectParameter(res, 'date', [
                    'InvalidTimestamp',
                ]);
            }

            // Hard lock: an approved month is the worker's confirmed record —
            // it must be revoked before any edit (new approval cycle).
            if (
                await isMonthApproved(
                    userId,
                    dayStart.getFullYear(),
                    dayStart.getMonth() + 1
                )
            ) {
                return responseErrorIllegalAction(res, 'MonthApprovedLocked');
            }

            const parsed = sessions.map((s) => ({
                type: s.type,
                timestamp: new Date(s.timestamp),
            }));

            for (const p of parsed) {
                if (
                    isNaN(p.timestamp.getTime()) ||
                    p.timestamp < dayStart ||
                    p.timestamp > dayEnd
                ) {
                    return responseErrorIncorrectParameter(res, 'timestamp', [
                        'OutOfDay',
                    ]);
                }
            }

            parsed.sort(
                (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
            );

            for (let i = 1; i < parsed.length; i++) {
                if (
                    parsed[i].timestamp.getTime() <=
                    parsed[i - 1].timestamp.getTime()
                ) {
                    return responseErrorIncorrectParameter(res, 'timestamp', [
                        'NotInOrder',
                    ]);
                }
            }

            if (!isCoherentSequence(parsed)) {
                return responseErrorIncorrectParameter(res, 'type', [
                    'NotInOrder',
                ]);
            }

            // Versioning / audit trail: the day's current sessions are never
            // deleted — they are flagged 'replaced' and the edited set is
            // stored as the next version of that (user, day) sequence, so the
            // record stays traceable and non-manipulable (CT 101/2019).
            // Serialized per user (same lock as the user-facing flows) so two
            // concurrent replacements can't compute the same next version.
            const now = new Date();
            const workSessions = await withUserLock(
                userId,
                () =>
                    runInTransaction(async (session) => {
                        const txOptions = session
                            ? { session }
                            : undefined;
                        const active = (await WorkSession.find(
                            {
                                userId,
                                timestamp: {
                                    $gte: dayStart,
                                    $lte: dayEnd,
                                },
                                status: { $ne: SESSION_REPLACED },
                            },
                            undefined,
                            txOptions
                        )) as unknown as (WorkSessionRow & {
                            version?: number;
                        })[];
                        const nextVersion =
                            active.reduce(
                                (max, s) => Math.max(max, s.version ?? 1),
                                0
                            ) + 1;
                        if (active.length > 0) {
                            await WorkSession.updateMany(
                                { _id: { $in: active.map((s) => s._id) } },
                                {
                                    $set: {
                                        status: SESSION_REPLACED,
                                        replacedByVersion: nextVersion,
                                        replacedAt: now,
                                        updatedAt: now,
                                    },
                                },
                                txOptions
                            );
                        }
                        const docs = parsed.map((p) => ({
                            userId,
                            type: p.type,
                            timestamp: p.timestamp,
                            source: SOURCE_ADMIN,
                            version: nextVersion,
                            status: SESSION_ACTIVE,
                            notes: reason ?? SESSION_REASON_ADMIN_CORRECTION,
                            createdAt: now,
                        }));
                        return session
                            ? WorkSession.insertMany(docs, { session })
                            : WorkSession.insertMany(docs);
                    })
            );

            res.status(200).json({
                success: true,
                data: { workSessions },
            });
        } catch (error) {
            console.error('Admin replace day work sessions error:', error);
            return responseErrorPut(res);
        }
        return;
    }

    if (req.method !== 'GET') {
        return responseErrorMethodNotAllowed(res);
    }

    if (
        !(await runValidation(
            validateQueryParams(AdminWorkSessionsQueryWithPaginationSchema),
            req,
            res
        ))
    )
        return;

    try {
        await dbConnect();

        const query = req.query as unknown as AdminWorkSessionsQuery;
        const { period } = query;
        const limit =
            req.query.limit !== undefined ? Number(req.query.limit) : undefined;
        const offset =
            req.query.offset !== undefined ? Number(req.query.offset) : 0;

        const days: Date[] = [];
        if (period === 'day') {
            const d = new Date(query.date as string);
            d.setHours(0, 0, 0, 0);
            days.push(d);
        } else if (period === 'week') {
            const d = new Date(query.date as string);
            d.setHours(0, 0, 0, 0);
            const diffToMonday = (d.getDay() + 6) % 7;
            d.setDate(d.getDate() - diffToMonday);
            for (let i = 0; i < 7; i++) {
                const day = new Date(d);
                day.setDate(d.getDate() + i);
                days.push(day);
            }
        } else if (period === 'month') {
            const y = query.year as number;
            const m = (query.month as number) - 1;
            const daysInMonth = new Date(y, m + 1, 0).getDate();
            for (let i = 1; i <= daysInMonth; i++) {
                days.push(new Date(y, m, i));
            }
        } else {
            const y = query.year as number;
            const daysInYear =
                (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
            for (let i = 1; i <= daysInYear; i++) {
                days.push(new Date(y, 0, i));
            }
        }

        const periodStart = new Date(days[0]);
        periodStart.setHours(0, 0, 0, 0);
        const periodEnd = new Date(days[days.length - 1]);
        periodEnd.setHours(23, 59, 59, 999);

        const yearSet = new Set<number>();
        days.forEach((d) => yearSet.add(d.getFullYear()));

        const [users, sessions, approvedVacations, yearlyTemplates, settings] =
            (await Promise.all([
                User.find(
                    {
                        role: { $ne: ADMIN_ROLE },
                        blocked: { $ne: true },
                        registered: true,
                    },
                    'name email dni expectedWorkHours workDays'
                )
                    .sort({ name: 1 })
                    .lean(),
                WorkSession.find({
                    timestamp: { $gte: periodStart, $lte: periodEnd },
                    status: { $ne: SESSION_REPLACED },
                })
                    .select('userId type timestamp source')
                    .sort({ timestamp: 1 })
                    .lean(),
                ElectiveVacation.find({
                    status: VACATION_APPROVED,
                    date: { $gte: periodStart, $lte: periodEnd },
                }).lean(),
                YearlyVacationDays.find({
                    userId: { $exists: false },
                    year: { $in: Array.from(yearSet) },
                }).lean(),
                getAppSettings(),
            ])) as unknown as [
                UserRow[],
                WorkSessionRow[],
                ElectiveVacationRow[],
                YearlyVacationRow[],
                Awaited<ReturnType<typeof getAppSettings>>,
            ];

        const sessionsByUserDay = new Map<string, WorkSessionRow[]>();
        for (const session of sessions) {
            const key = `${session.userId}:${dateKey(new Date(session.timestamp))}`;
            const list = sessionsByUserDay.get(key) ?? [];
            list.push(session);
            sessionsByUserDay.set(key, list);
        }

        const vacationByUserDay = new Set<string>();
        for (const v of approvedVacations) {
            vacationByUserDay.add(`${v.userId}:${dateKey(new Date(v.date))}`);
        }

        const obligatoryDaySet = new Set<string>();
        for (const template of yearlyTemplates) {
            for (const day of template.obligatoryDays ?? []) {
                obligatoryDaySet.add(dateKey(new Date(day)));
            }
        }

        const rows: AdminWorkSessionRow[] = [];

        for (const day of days) {
            const key = dateKey(day);
            const dow = day.getDay();

            for (const user of users) {
                const userSessions =
                    sessionsByUserDay.get(`${user._id}:${key}`) ?? [];
                const onVacation =
                    vacationByUserDay.has(`${user._id}:${key}`) ||
                    obligatoryDaySet.has(key);

                // A user's non-working week days: their own override, else company-wide.
                const nonWorkingDays =
                    Array.isArray(user.workDays) && user.workDays.length > 0
                        ? user.workDays
                        : settings.nonWorkingDays;
                const isNonWorkingDay = nonWorkingDays.includes(dow);

                const expectedHours = user.expectedWorkHours ?? DEFAULT_EXPECTED_WORK_HOURS;
                const { totalHours, anomalies } = computeDayHours(userSessions);
                const anomalySet = new Set(anomalies);

                let status: WorkSessionRowStatus = 'anomaly';
                if (onVacation) {
                    status = 'vacation';
                    anomalySet.clear();
                } else if (isNonWorkingDay) {
                    status = 'nonWorkingDay';
                    anomalySet.clear();
                } else if (anomalySet.size > 0) {
                    status = 'anomaly';
                } else if (totalHours === 0) {
                    anomalySet.add('hours_short');
                    status = 'anomaly';
                } else if (
                    isWithinBenevolence(
                        totalHours,
                        expectedHours,
                        settings.toleranceHours
                    )
                ) {
                    status = 'ok';
                } else {
                    anomalySet.add(
                        totalHours < expectedHours
                            ? 'hours_short'
                            : 'hours_over'
                    );
                    status = 'anomaly';
                }

                rows.push({
                    userId: user._id.toString(),
                    userName: user.name,
                    date: key,
                    totalHours,
                    expectedHours,
                    sessions: userSessions.map((s) => ({
                        ...s,
                        _id: s._id.toString(),
                    })),
                    status,
                    anomalies: Array.from(anomalySet),
                });
            }
        }

        rows.sort(
            (a, b) =>
                a.date.localeCompare(b.date) ||
                a.userName.localeCompare(b.userName)
        );

        // Server-side pagination bounds the response (critical for year views,
        // where rows = users × days). When no limit is given, behave as before.
        const total = rows.length;
        const pageRows =
            limit !== undefined ? rows.slice(offset, offset + limit) : rows;

        res.status(200).json({
            success: true,
            data:
                limit !== undefined
                    ? { rows: pageRows, total, limit, offset }
                    : { rows: pageRows },
        });
    } catch (error) {
        console.error('Admin work sessions error:', error);
        return responseErrorGet(res);
    }
}

export default requireRole([ADMIN_ROLE], handler);
