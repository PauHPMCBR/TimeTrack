import { withApi } from '@/lib/api-handler';
import {
    SOURCE_ADMIN,
    SESSION_ACTIVE,
    SESSION_REPLACED,
    SESSION_REASON_ADMIN_CORRECTION,
    VACATION_APPROVED,
    APPROVAL_APPROVED,
} from 'shared/src/lib/constants';
import {
    User,
    WorkSession,
    MonthlyApproval,
} from '@/models';
import {
    findActiveInRange,
} from '@/repositories/work-session-repository';
import {
    findOverlapping,
    findGlobalTemplates,
} from '@/repositories/vacation-repository';
import { getAppSettings } from '@/lib/settings';
import { runInTransaction } from '@/lib/transaction';
import {
    parsePagination,
    paginateRows,
} from '@/lib/pagination';
import {
    UserRow,
    WorkSessionRow,
    ElectiveVacationRow,
    YearlyVacationRow,
} from '@/lib/rows';
import { isCoherentSequence } from 'shared/src/lib/work-hours';
import {
    responseErrorEntryNotFound,
    responseErrorGet,
    responseErrorIllegalAction,
    responseErrorIncorrectParameter,
    responseErrorMethodNotAllowed,
    responseErrorPut,
} from '@/lib/response-error-generator';
import {
    AdminWorkSessionsQueryWithPaginationSchema,
    AdminWorkSessionsQuery,
    AdminWorkSessionRow,
    AdminReplaceDayWorkSessionsRequestSchema,
} from 'shared/src/schemas/api';
import { withUserLock } from '@/lib/user-lock';
import { isMonthApproved } from '@/lib/monthly-approvals';
import type { NextApiRequest, NextApiResponse } from 'next';
import {
    buildWorkSessionRows,
    computeDaysForPeriod,
} from '@/lib/work-session-rows';

const putHandler = withApi(
    {
        method: 'PUT',
        guard: 'admin',
        body: AdminReplaceDayWorkSessionsRequestSchema,
    },
    async (_req, res, { body }) => {
        try {
            const { userId, date, sessions, reason } = body;

            const user = await User.findById(userId);
            if (!user || user.deleted) {
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
                        const active = (await findActiveInRange(
                            dayStart,
                            dayEnd,
                            { userId, endInclusive: true, session: session ?? undefined }
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
    }
);

const getHandler = withApi(
    {
        method: 'GET',
        guard: 'admin',
        query: AdminWorkSessionsQueryWithPaginationSchema,
    },
    async (req, res) => {
        try {
        const query = req.query as unknown as AdminWorkSessionsQuery;
        const { period } = query;
        const { limit, offset } = parsePagination(req.query);

        const days: Date[] = computeDaysForPeriod(
            period,
            query.date as string | undefined,
            query.year as number | undefined,
            query.month as number | undefined
        );

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
                        blocked: { $ne: true },
                        registered: true,
                        deleted: { $ne: true },
                        // Users who don't need to check in are excluded entirely from
                        // the events report (they never show as non-working rows).
                        checkInRequired: { $ne: false },
                    },
                    'name email dni expectedWorkHours workDays'
                )
                    .sort({ name: 1 })
                    .lean(),
                findActiveInRange(periodStart, periodEnd, {
                    endInclusive: true,
                })
                    .select('userId type timestamp source')
                    .sort({ timestamp: 1 })
                    .lean(),
                findOverlapping(periodStart, periodEnd, {
                    statuses: VACATION_APPROVED,
                }).lean(),
                findGlobalTemplates(Array.from(yearSet)).lean(),
                getAppSettings(),
            ])) as unknown as [
                UserRow[],
                WorkSessionRow[],
                ElectiveVacationRow[],
                YearlyVacationRow[],
                Awaited<ReturnType<typeof getAppSettings>>,
            ];

        const rows: AdminWorkSessionRow[] = buildWorkSessionRows({
            days,
            users,
            sessions,
            approvedVacations,
            yearlyTemplates,
            defaultNonWorkingDays: settings.nonWorkingDays,
            defaultExpectedHours: settings.defaultExpectedHours,
            toleranceHours: settings.toleranceHours,
        });

        rows.sort(
            (a, b) =>
                a.date.localeCompare(b.date) ||
                a.userName.localeCompare(b.userName)
        );

        // Determine which months in the requested period are already approved by
        // their workers — those days are locked and not editable.
        const periodMonthKeys = new Set(
            days.map((d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
        );
        const yearsInPeriod = Array.from(
            new Set(days.map((d) => d.getFullYear()))
        );

        let approvedDocs: { _id: string; userId: string; year: number; month: number }[];
        if (yearsInPeriod.length > 0 && periodMonthKeys.size > 0) {
            approvedDocs = await MonthlyApproval.find({
                status: APPROVAL_APPROVED,
                year: { $in: yearsInPeriod },
            }).lean() as unknown as typeof approvedDocs;
        } else {
            approvedDocs = [];
        }

        const approvedMonths = new Set<string>();
        for (const doc of approvedDocs) {
            const key = `${doc.year}-${String(doc.month).padStart(2, '0')}`;
            if (periodMonthKeys.has(key)) {
                // Include userId to ensure the lock only applies to the user whose month is actually approved
                approvedMonths.add(`${doc.userId}:${key}`);
            }
        }

        // Server-side pagination bounds the response (critical for year views,
        // where rows = users × days). When no limit is given, behave as before.
        const { total, pageRows } = paginateRows(rows, limit, offset);

        res.status(200).json({
            success: true,
            data:
                limit !== undefined
                    ? { rows: pageRows, total, limit, offset, approvedMonths: Array.from(approvedMonths) }
                    : { rows: pageRows, approvedMonths: Array.from(approvedMonths) },
        });
        } catch (error) {
            console.error('Admin work sessions error:', error);
            return responseErrorGet(res);
        }
    }
);

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'PUT') return putHandler(req, res);
    if (req.method === 'GET') return getHandler(req, res);
    return responseErrorMethodNotAllowed(res);
}
