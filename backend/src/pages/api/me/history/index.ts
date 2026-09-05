import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { authenticateToken, AuthRequest } from '@/lib/auth';
import {
    User,
    WorkSession,
    ElectiveVacation,
    YearlyVacationDays,
} from '@/models';
import { getAppSettings } from '@/lib/settings';
import {
    SESSION_REPLACED,
    VACATION_APPROVED,
    APPROVAL_APPROVED,
} from 'shared/src/lib/constants';
import { MonthlyApproval } from '@/models';
import {
    responseErrorGet,
    responseErrorMethodNotAllowed,
} from '@/lib/response-error-generator';
import { runValidation, validateQueryParams } from '@/lib/validation';
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
import {
    buildWorkSessionRows,
    computeDaysForPeriod,
} from '@/lib/work-session-rows';

// Personal work-session report: the same rows (status, expected hours,
// anomalies) shown in the admin fitxatges view, but restricted to the
// authenticated user's own data. Shares the row-building logic with the admin
// endpoint so personal and admin views always agree.
async function handler(req: AuthRequest, res: NextApiResponse) {
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

        const userId = req.user!.userId as string;
        const query = req.query as unknown as AdminWorkSessionsQuery;
        const { period } = query;
        const limit =
            req.query.limit !== undefined ? Number(req.query.limit) : undefined;
        const offset =
            req.query.offset !== undefined ? Number(req.query.offset) : 0;

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
                User.findById(userId, 'name email dni expectedWorkHours workDays')
                    .lean(),
                WorkSession.find({
                    userId,
                    timestamp: { $gte: periodStart, $lte: periodEnd },
                    status: { $ne: SESSION_REPLACED },
                })
                    .select('userId type timestamp source')
                    .sort({ timestamp: 1 })
                    .lean(),
                ElectiveVacation.find({
                    userId,
                    status: VACATION_APPROVED,
                    date: { $gte: periodStart, $lte: periodEnd },
                }).lean(),
                YearlyVacationDays.find({
                    userId: { $exists: false },
                    year: { $in: Array.from(yearSet) },
                }).lean(),
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

        const total = rows.length;
        const pageRows =
            limit !== undefined ? rows.slice(offset, offset + limit) : rows;

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

export default authenticateToken(handler);
