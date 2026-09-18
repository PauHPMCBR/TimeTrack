import { withApi } from '@/lib/api-handler';
import {
    User,
} from '@/models';
import { findActiveInRange } from '@/repositories/work-session-repository';
import {
    findOverlapping,
    findGlobalTemplates,
} from '@/repositories/vacation-repository';
import { getAppSettings } from '@/lib/settings';
import {
    VACATION_APPROVED,
    APPROVAL_APPROVED,
} from 'shared/src/lib/constants';
import { MonthlyApproval } from '@/models';
import {
    AdminWorkSessionsQueryWithPaginationSchema,
    AdminWorkSessionsQuery,
    AdminWorkSessionRow,
} from 'shared/src/schemas/api';
import {
    UserRow,
    WorkSessionRow,
    ElectiveVacationRow,
    YearlyVacationRow,
    AuthorizedLeaveRow,
    WorkDayRecordRow,
} from '@/lib/rows';
import { responseErrorGet } from '@/lib/response-error-generator';
import {
    buildWorkSessionRows,
    computeDaysForPeriod,
    daySourceMap,
    workDayRecordMap,
} from '@/lib/work-session-rows';
import type { DateKey } from 'shared/src/lib/day-key';
import {
    parsePagination,
    paginateRows,
} from '@/lib/pagination';
import { dayRange } from '@/lib/date-range';
import {
    findWorkDaySources,
} from '@/repositories/work-day-source-repository';
import { findLeavesOverlapping } from '@/repositories/authorized-leave-repository';
import { findWorkDayRecords } from '@/repositories/work-day-record-repository';

// Personal work-session report: the same rows (status, expected hours,
// anomalies) shown in the admin fitxatges view, but restricted to the
// authenticated user's own data. Shares the row-building logic with the admin
// endpoint so personal and admin views always agree.
export default withApi(
    {
        method: 'GET',
        query: AdminWorkSessionsQueryWithPaginationSchema,
    },
    async (req, res) => {
    try {

        const userId = req.user!.userId as string;
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

        const [user, sessions, approvedVacations, yearlyTemplates, settings, daySources, authorizedLeaves, dayRecords] =
            (await Promise.all([
                User.findById(userId, 'name email emailEncrypted dni dniEncrypted weeklyExpectedHours scheduleMode timetable')
                    .lean(),
                findActiveInRange(periodStart, periodEnd, {
                    userId,
                })
                    .select(
                        'userId type timestamp overtime notes notesEncrypted editReason editReasonEncrypted createdAt'
                    )
                    .sort({ timestamp: 1 })
                    .lean(),
                findOverlapping(vacationStart, vacationEnd, {
                    userId,
                    statuses: VACATION_APPROVED,
                }).lean(),
                findGlobalTemplates(Array.from(yearSet)).lean(),
                getAppSettings(),
                findWorkDaySources(days, [userId]),
                findLeavesOverlapping(vacationStart, vacationEnd, {
                    userId,
                }).lean(),
                findWorkDayRecords(days, userId),
            ])) as unknown as [
                UserRow | null,
                WorkSessionRow[],
                ElectiveVacationRow[],
                YearlyVacationRow[],
                Awaited<ReturnType<typeof getAppSettings>>,
                Awaited<ReturnType<typeof findWorkDaySources>>,
                AuthorizedLeaveRow[],
                WorkDayRecordRow[],
            ];

        if (!user) {
            return responseErrorGet(res);
        }

        const rows: AdminWorkSessionRow[] = buildWorkSessionRows({
            days,
            users: [user], // single-user: only the caller's own data
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

        rows.sort((a, b) => a.date.localeCompare(b.date) || a.userName.localeCompare(b.userName));

        // Determine which months in the requested period are approved by this user.
        const periodMonthKeys = new Set(days.map((d) => d.slice(0, 7)));
        const yearsInPeriod = Array.from(
            new Set(days.map((d) => Number(d.slice(0, 4))))
        );

        let approvedDocs: { _id: string; userId: string; year: number; month: number }[];
        if (yearsInPeriod.length > 0 && periodMonthKeys.size > 0) {
            approvedDocs = await MonthlyApproval.find({
                userId,
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
                // Include userId for consistency (even though we're filtering by userId)
                approvedMonths.add(`${doc.userId}:${key}`);
            }
        }

        const { total, pageRows } = paginateRows(rows, limit, offset);

        res.status(200).json({
            success: true,
            data:
                limit !== undefined
                    ? { rows: pageRows, total, limit, offset, approvedMonths: Array.from(approvedMonths), timetableToleranceMinutes: settings.timetableToleranceMinutes }
                    : { rows: pageRows, approvedMonths: Array.from(approvedMonths), timetableToleranceMinutes: settings.timetableToleranceMinutes },
        });
    } catch (error) {
        console.error('Personal work sessions error:', error);
        return responseErrorGet(res);
    }
    }
);
