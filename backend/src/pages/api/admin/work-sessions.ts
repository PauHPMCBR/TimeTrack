import { withApi } from '@/lib/api-handler';
import {
    SOURCE_ADMIN_MANUAL,
    VACATION_APPROVED,
    APPROVAL_APPROVED,
} from 'shared/src/lib/constants';
import {
    User,
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
import { replaceDaySessions } from '@/lib/replace-day';
import { findWorkDaySources } from '@/repositories/work-day-source-repository';
import { findLeavesOverlapping } from '@/repositories/authorized-leave-repository';
import { findWorkDayRecords } from '@/repositories/work-day-record-repository';
import { dayRange } from '@/lib/date-range';
import {
    parsePagination,
    paginateRows,
} from '@/lib/pagination';
import {
    UserRow,
    WorkSessionRow,
    ElectiveVacationRow,
    YearlyVacationRow,
    AuthorizedLeaveRow,
    WorkDayRecordRow,
} from '@/lib/rows';
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
import type { NextApiRequest, NextApiResponse } from 'next';
import {
    buildWorkSessionRows,
    computeDaysForPeriod,
    daySourceMap,
    workDayRecordMap,
} from '@/lib/work-session-rows';
import type { DateKey } from 'shared/src/lib/day-key';

const putHandler = withApi(
    {
        method: 'PUT',
        guard: 'admin',
        body: AdminReplaceDayWorkSessionsRequestSchema,
        audit: {
            action: 'work_sessions_replaced',
            targetType: 'work_session_day',
            targetId: (_req, ctx) =>
                `${(ctx.body as { userId: string }).userId}:${(ctx.body as { date: string }).date}`,
            metadata: (req, ctx) => ({
                count: (ctx.body as { sessions: unknown[] }).sessions.length,
                source: 'adminManual',
            }),
        },
    },
    async (req, res, { body }) => {
        try {
            const { userId, date, sessions, reason } = body;

            const user = await User.findById(userId);
            if (!user || user.deleted) {
                return responseErrorEntryNotFound(res, 'User');
            }

            const result = await replaceDaySessions({
                userId,
                date,
                sessions,
                reason,
                source: SOURCE_ADMIN_MANUAL,
                editedBy: req.user!.userId,
            });
            if (!result.ok) {
                if (result.code === 'MonthApprovedLocked') {
                    return responseErrorIllegalAction(
                        res,
                        'MonthApprovedLocked'
                    );
                }
                if (result.code === 'InvalidDate') {
                    return responseErrorIncorrectParameter(res, 'date', [
                        'InvalidTimestamp',
                    ]);
                }
                if (result.code === 'OutOfDay') {
                    return responseErrorIncorrectParameter(res, 'time', [
                        'OutOfDay',
                    ]);
                }
                return responseErrorIncorrectParameter(res, result.field, [
                    'NotInOrder',
                ]);
            }

            res.status(200).json({
                success: true,
                data: { workSessions: result.workSessions },
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

        const days: DateKey[] = computeDaysForPeriod(
            period,
            query.date as string | undefined,
            query.year as number | undefined,
            query.month as number | undefined
        );

        // Session bounds are company-zone instants; vacations are key
        // intervals compared against the same window.
        const periodStart = dayRange(days[0]).start;
        const periodEnd = dayRange(days[days.length - 1]).end;
        const vacationStart = days[0];
        const vacationEnd = days[days.length - 1];

        const yearSet = new Set<number>(
            days.map((d) => Number(d.slice(0, 4)))
        );

            const [users, sessions, approvedVacations, yearlyTemplates, settings, daySources, authorizedLeaves, dayRecords] =
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
                    'name email emailEncrypted dni dniEncrypted weeklyExpectedHours scheduleMode timetable'
                )
                    .sort({ name: 1 })
                    .lean(),
                findActiveInRange(periodStart, periodEnd)
                    .select(
                        'userId type timestamp overtime notes notesEncrypted editReason editReasonEncrypted createdAt'
                    )
                    .sort({ timestamp: 1 })
                    .lean(),
                findOverlapping(vacationStart, vacationEnd, {
                    statuses: VACATION_APPROVED,
                }).lean(),
                findGlobalTemplates(Array.from(yearSet)).lean(),
                getAppSettings(),
                findWorkDaySources(days),
                findLeavesOverlapping(vacationStart, vacationEnd).lean(),
                findWorkDayRecords(days),
            ])) as unknown as [
                UserRow[],
                WorkSessionRow[],
                ElectiveVacationRow[],
                YearlyVacationRow[],
                Awaited<ReturnType<typeof getAppSettings>>,
                Awaited<ReturnType<typeof findWorkDaySources>>,
                AuthorizedLeaveRow[],
                WorkDayRecordRow[],
            ];

        const rows: AdminWorkSessionRow[] = buildWorkSessionRows({
            days,
            users,
            sessions,
            approvedVacations,
            yearlyTemplates,
            authorizedLeaves,
            records: workDayRecordMap(dayRecords),
            defaultWeeklyExpectedHours: settings.defaultWeeklyExpectedHours,
            toleranceMinutes: settings.toleranceMinutes,
            timetableToleranceMinutes: settings.timetableToleranceMinutes,
            timezone: settings.timezone,
            daySources: daySourceMap(daySources),
        });

        rows.sort(
            (a, b) =>
                a.date.localeCompare(b.date) ||
                a.userName.localeCompare(b.userName)
        );

        // Determine which months in the requested period are already approved by
        // their workers — those days are locked and not editable.
        const periodMonthKeys = new Set(days.map((d) => d.slice(0, 7)));
        const yearsInPeriod = Array.from(
            new Set(days.map((d) => Number(d.slice(0, 4))))
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
                    ? { rows: pageRows, total, limit, offset, approvedMonths: Array.from(approvedMonths), timetableToleranceMinutes: settings.timetableToleranceMinutes }
                    : { rows: pageRows, approvedMonths: Array.from(approvedMonths), timetableToleranceMinutes: settings.timetableToleranceMinutes },
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
