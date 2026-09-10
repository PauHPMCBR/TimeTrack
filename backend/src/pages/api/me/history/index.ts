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
} from '@/lib/rows';
import { responseErrorGet } from '@/lib/response-error-generator';
import {
    buildWorkSessionRows,
    computeDaysForPeriod,
} from '@/lib/work-session-rows';
import {
    parsePagination,
    paginateRows,
} from '@/lib/pagination';

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

        const [user, sessions, approvedVacations, yearlyTemplates, settings] =
            (await Promise.all([
                User.findById(userId, 'name email emailEncrypted dni dniEncrypted expectedWorkHours workDays')
                    .lean(),
                findActiveInRange(periodStart, periodEnd, {
                    userId,
                    endInclusive: true,
                })
                    .select(
                        'userId type timestamp source overtime notes notesEncrypted editReason editReasonEncrypted createdAt'
                    )
                    .sort({ timestamp: 1 })
                    .lean(),
                findOverlapping(periodStart, periodEnd, {
                    userId,
                    statuses: VACATION_APPROVED,
                }).lean(),
                findGlobalTemplates(Array.from(yearSet)).lean(),
                getAppSettings(),
            ])) as unknown as [
                UserRow | null,
                WorkSessionRow[],
                ElectiveVacationRow[],
                YearlyVacationRow[],
                Awaited<ReturnType<typeof getAppSettings>>,
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
            defaultNonWorkingDays: settings.nonWorkingDays,
            defaultExpectedHours: settings.defaultExpectedHours,
            toleranceHours: settings.toleranceHours,
        });

        rows.sort((a, b) => a.date.localeCompare(b.date) || a.userName.localeCompare(b.userName));

        // Determine which months in the requested period are approved by this user.
        const periodMonthKeys = new Set(
            days.map((d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
        );
        const yearsInPeriod = Array.from(
            new Set(days.map((d) => d.getFullYear()))
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
                    ? { rows: pageRows, total, limit, offset, approvedMonths: Array.from(approvedMonths) }
                    : { rows: pageRows, approvedMonths: Array.from(approvedMonths) },
        });
    } catch (error) {
        console.error('Personal work sessions error:', error);
        return responseErrorGet(res);
    }
    }
);
