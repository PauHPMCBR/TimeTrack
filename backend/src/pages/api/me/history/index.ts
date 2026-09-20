import { withApi } from '@/lib/api-handler';
import {
    User,
} from '@/models';
import { findActiveDaySessions } from '@/repositories/work-day-sessions-repository';
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
    MonthlyApprovalRow,
} from 'shared/src/schemas/api';
import {
    UserRow,
    DaySessionsRow,
    ElectiveVacationRow,
    YearlyVacationRow,
    AuthorizedLeaveRow,
} from '@/lib/rows';
import { responseErrorGet } from '@/lib/response-error-generator';
import {
    buildWorkSessionRows,
    computeDaysForPeriod,
    workDayRecordMap,
} from '@/lib/work-session-rows';
import type { DateKey } from 'shared/src/lib/day-key';
import {
    parsePagination,
    paginateRows,
} from '@/lib/pagination';
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

        // Sessions are keyed by their own company-zone `date` field; vacations
        // are key intervals compared against the same day range.
        const vacationStart = days[0];
        const vacationEnd = days[days.length - 1];

        const yearSet = new Set<number>(
            days.map((d) => Number(d.slice(0, 4)))
        );

        const [user, dayDocs, approvedVacations, yearlyTemplates, settings, authorizedLeaves, dayRecords] =
            await Promise.all([
                User.findById(userId, 'name email emailEncrypted dni dniEncrypted weeklyExpectedHours scheduleMode timetable')
                    .lean<UserRow | null>(),
                findActiveDaySessions(days[0], days[days.length - 1], {
                    userId,
                })
                    .sort({ date: 1 })
                    .lean<DaySessionsRow[]>(),
                findOverlapping(vacationStart, vacationEnd, {
                    userId,
                    statuses: VACATION_APPROVED,
                }).lean<ElectiveVacationRow[]>(),
                findGlobalTemplates(Array.from(yearSet)).lean<YearlyVacationRow[]>(),
                getAppSettings(),
                findLeavesOverlapping(vacationStart, vacationEnd, {
                    userId,
                }).lean<AuthorizedLeaveRow[]>(),
                findWorkDayRecords(days, userId),
            ]);

        if (!user) {
            return responseErrorGet(res);
        }

        const rows: AdminWorkSessionRow[] = buildWorkSessionRows({
            days,
            users: [user], // single-user: only the caller's own data
            daySessions: dayDocs,
            approvedVacations,
            yearlyTemplates,
            authorizedLeaves,
            records: workDayRecordMap(dayRecords),
            defaultWeeklyExpectedHours: settings.defaultWeeklyExpectedHours,
            toleranceMinutes: settings.toleranceMinutes,
            timetableToleranceMinutes: settings.timetableToleranceMinutes,
        });

        rows.sort((a, b) => a.date.localeCompare(b.date) || a.userName.localeCompare(b.userName));

        // Determine which months in the requested period are approved by this user.
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
                userId,
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
