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
import { findActiveDaySessions } from '@/repositories/work-day-sessions-repository';
import {
    findOverlapping,
    findGlobalTemplates,
} from '@/repositories/vacation-repository';
import { getAppSettings } from '@/lib/settings';
import { replaceDaySessions } from '@/lib/replace-day';
import { findLeavesOverlapping } from '@/repositories/authorized-leave-repository';
import { findWorkDayRecords } from '@/repositories/work-day-record-repository';
import {
    parsePagination,
    paginateRows,
} from '@/lib/pagination';
import {
    UserRow,
    DaySessionsRow,
    ElectiveVacationRow,
    YearlyVacationRow,
    AuthorizedLeaveRow,
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
    MonthlyApprovalRow,
} from 'shared/src/schemas/api';
import type { NextApiRequest, NextApiResponse } from 'next';
import {
    buildWorkSessionRows,
    computeDaysForPeriod,
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
                data: { workDaySessions: result.workDaySessions },
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

        // Sessions are keyed by their own company-zone `date` field; vacations
        // are key intervals compared against the same day range.
        const vacationStart = days[0];
        const vacationEnd = days[days.length - 1];

        const yearSet = new Set<number>(
            days.map((d) => Number(d.slice(0, 4)))
        );

            const [users, dayDocs, approvedVacations, yearlyTemplates, settings, authorizedLeaves, dayRecords] =
            await Promise.all([
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
                    .lean<UserRow[]>(),
                findActiveDaySessions(days[0], days[days.length - 1])
                    .sort({ date: 1 })
                    .lean<DaySessionsRow[]>(),
                findOverlapping(vacationStart, vacationEnd, {
                    statuses: VACATION_APPROVED,
                }).lean<ElectiveVacationRow[]>(),
                findGlobalTemplates(Array.from(yearSet)).lean<YearlyVacationRow[]>(),
                getAppSettings(),
                findLeavesOverlapping(vacationStart, vacationEnd).lean<
                    AuthorizedLeaveRow[]
                >(),
                findWorkDayRecords(days),
            ]);

        const rows: AdminWorkSessionRow[] = buildWorkSessionRows({
            days,
            users,
            daySessions: dayDocs,
            approvedVacations,
            yearlyTemplates,
            authorizedLeaves,
            records: workDayRecordMap(dayRecords),
            defaultWeeklyExpectedHours: settings.defaultWeeklyExpectedHours,
            toleranceMinutes: settings.toleranceMinutes,
            timetableToleranceMinutes: settings.timetableToleranceMinutes,
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

        let approvedDocs: Pick<
            MonthlyApprovalRow,
            'userId' | 'year' | 'month'
        >[];
        if (yearsInPeriod.length > 0 && periodMonthKeys.size > 0) {
            approvedDocs = await MonthlyApproval.find({
                status: APPROVAL_APPROVED,
                year: { $in: yearsInPeriod },
            }).lean<Pick<MonthlyApprovalRow, 'userId' | 'year' | 'month'>[]>();
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
