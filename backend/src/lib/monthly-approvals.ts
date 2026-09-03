import dbConnect from '@/lib/mongodb';
import {
    MonthlyApproval,
    User,
    WorkSession,
    ElectiveVacation,
    YearlyVacationDays,
    AppSettings,
} from '@/models';
import {
    ADMIN_ROLE,
    APPROVAL_APPROVED,
    APPROVAL_PENDING,
    MS_PER_DAY,
    SESSION_REPLACED,
    VACATION_APPROVED,
} from 'shared/src/lib/constants';
import { DEFAULT_FRONTEND_URL } from 'shared/src/lib/defaults';
import type { WorkSessionAnomaly } from 'shared/src/schemas/api';
import {
    computeDayHours,
    isWithinBenevolence,
} from 'shared/src/lib/work-hours';
import { dateKey } from '@/lib/date-key';
import { getAppSettings, invalidateAppSettingsCache } from '@/lib/settings';
import {
    sendAdminMonthlyReview,
    sendMonthlyApprovalReminder,
    sendMonthlyApprovalRequest,
} from '@/lib/mail';

export interface MonthPeriod {
    year: number;
    month: number; // 1-12
}

/** "YYYY-MM" key of a Date (local). */
export function monthKeyOf(d: Date): string {
    return dateKey(d).slice(0, 7);
}

/** The calendar month before the month of `d` (local). */
export function previousMonthOf(d: Date): MonthPeriod {
    const year = d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear();
    const month = d.getMonth() === 0 ? 12 : d.getMonth();
    return { year, month };
}

/** True when (year, month) is a fully elapsed calendar month (local). */
export function isPastMonth(year: number, month: number, now: Date): boolean {
    const current = now.getFullYear() * 12 + now.getMonth();
    const target = year * 12 + (month - 1);
    return target < current;
}

/**
 * Whether the worker's record for that month is already confirmed (hard
 * lock): no writes to that (user, month) are allowed until an admin revokes
 * the approval.
 */
export async function isMonthApproved(
    userId: string,
    year: number,
    month: number
): Promise<boolean> {
    await dbConnect();
    const doc = await MonthlyApproval.findOne({
        userId,
        year,
        month,
        status: APPROVAL_APPROVED,
    });
    return !!doc;
}

/**
 * Distinct anomalies across the working days of the user's month — the same
 * criteria as the admin report (structural anomalies, hours outside the
 * expected ± tolerance band; vacation and non-working days are skipped).
 * An empty result means the month is clean and can be opened for approval.
 */
export async function computeMonthAnomalies(
    userId: string,
    year: number,
    month: number
): Promise<WorkSessionAnomaly[]> {
    await dbConnect();
    const [user, settings] = (await Promise.all([
        User.findById(userId, 'expectedWorkHours workDays trackingStartDate checkInRequired').lean(),
        getAppSettings(),
    ])) as unknown as [
        {
            expectedWorkHours?: number;
            workDays?: number[];
            trackingStartDate?: Date | null;
            checkInRequired?: boolean;
        } | null,
        Awaited<ReturnType<typeof getAppSettings>>,
    ];
    if (!user) return [];
    if (user.checkInRequired === false) return [];

    const expectedHours =
        user.expectedWorkHours ?? settings.defaultExpectedHours;
    const nonWorkingDays =
        Array.isArray(user.workDays) && user.workDays.length > 0
            ? user.workDays
            : settings.nonWorkingDays;

    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end =
        month === 12 ? new Date(year + 1, 0, 1) : new Date(year, month, 1);
    const daysInMonth = new Date(year, month, 0).getDate();

    // Only evaluate days from the user's tracking start onward (if known).
    const trackingStart = user.trackingStartDate
        ? new Date(user.trackingStartDate)
        : null;

    const [sessions, approvedVacations, yearlyTemplates] = (await Promise.all([
        WorkSession.find({
            userId,
            timestamp: { $gte: start, $lt: end },
            status: { $ne: SESSION_REPLACED },
        })
            .sort({ timestamp: 1 })
            .lean(),
        ElectiveVacation.find({
            userId,
            status: VACATION_APPROVED,
            date: { $gte: start, $lt: end },
        }).lean(),
        YearlyVacationDays.find({ userId: { $exists: false }, year }).lean(),
    ])) as unknown as [
        { timestamp: Date | string; type: 'check_in' | 'check_out' }[],
        { date: Date | string }[],
        { obligatoryDays?: Date[] }[],
    ];

    const vacationSet = new Set<string>();
    for (const v of approvedVacations) {
        vacationSet.add(dateKey(new Date(v.date)));
    }
    const obligatorySet = new Set<string>();
    for (const template of yearlyTemplates) {
        for (const day of template.obligatoryDays ?? []) {
            obligatorySet.add(dateKey(new Date(day)));
        }
    }

    const anomalySet = new Set<WorkSessionAnomaly>();
    for (let day = 1; day <= daysInMonth; day++) {
        const dayDate = new Date(year, month - 1, day);
        const key = dateKey(dayDate);
        if (trackingStart && dayDate < trackingStart) continue;
        if (nonWorkingDays.includes(dayDate.getDay())) continue;
        if (vacationSet.has(key) || obligatorySet.has(key)) continue;

        const daySessions = sessions.filter(
            (s) => dateKey(new Date(s.timestamp)) === key
        );
        const { totalHours, anomalies } = computeDayHours(daySessions);
        const dayAnomalies = new Set(anomalies);
        if (dayAnomalies.size === 0) {
            if (totalHours === 0) {
                dayAnomalies.add('hours_short');
            } else if (
                !isWithinBenevolence(
                    totalHours,
                    expectedHours,
                    settings.toleranceHours
                )
            ) {
                dayAnomalies.add(
                    totalHours < expectedHours ? 'hours_short' : 'hours_over'
                );
            }
        }
        dayAnomalies.forEach((a) => anomalySet.add(a));
    }
    return Array.from(anomalySet);
}

/**
 * End-of-month job: mail the admins once per month asking them to review the
 * previous month's records and open it for the workers' approval. Bookkeeping
 * is stored in AppSettings.lastMonthlyReviewReminder ("YYYY-MM").
 */
export async function runMonthlyAdminReview(now: Date = new Date()): Promise<number> {
    await dbConnect();
    const monthKey = monthKeyOf(now);

    const settings = await AppSettings.findOne({});
    if (settings && settings.lastMonthlyReviewReminder === monthKey) {
        return 0;
    }

    const period = previousMonthOf(now);
    const frontendUrl = process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL;
    const reviewUrl = `${frontendUrl}/admin/monthly-approvals?year=${period.year}&month=${period.month}`;

    const admins = (await User.find(
        { role: ADMIN_ROLE, registered: true },
        'email'
    ).lean()) as unknown as { email: string }[];

    for (const admin of admins) {
        if (!admin.email) continue;
        await sendAdminMonthlyReview({
            to: admin.email,
            period,
            reviewUrl,
        });
    }

    await AppSettings.updateOne(
        {},
        {
            $set: { lastMonthlyReviewReminder: monthKey, updatedAt: new Date() },
        },
        { upsert: true }
    );
    invalidateAppSettingsCache();

    return admins.length;
}

/**
 * Daily job: remind workers whose monthly record confirmation is still
 * pending X days after it was requested (single reminder per request; the
 * X comes from the company setting monthlyApprovalReminderDays).
 */
export async function runMonthlyApprovalReminders(
    now: Date = new Date()
): Promise<number> {
    await dbConnect();
    const settings = await getAppSettings();
    const cutoff = new Date(now.getTime() - settings.monthlyApprovalReminderDays * MS_PER_DAY);

    const pending = (await MonthlyApproval.find({
        status: APPROVAL_PENDING,
        reminderSentAt: null,
        requestedAt: { $lte: cutoff },
    }).lean()) as unknown as {
        _id: unknown;
        userId: string;
        year: number;
        month: number;
    }[];

    let sent = 0;
    const frontendUrl = process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL;
    for (const doc of pending) {
        const user = (await User.findById(
            doc.userId,
            'name email'
        )) as unknown as { name: string; email: string } | null;
        if (!user?.email) continue;

        await sendMonthlyApprovalReminder({
            to: user.email,
            name: user.name,
            period: { year: doc.year, month: doc.month },
            approveUrl: `${frontendUrl}/check-in`,
        });
        await MonthlyApproval.updateOne(
            { _id: doc._id },
            { $set: { reminderSentAt: new Date() } }
        );
        sent++;
    }
    return sent;
}

/**
 * Opens a month for a worker's approval (admin action): creates/resets the
 * approval document and mails the worker. Assumes the caller has already
 * checked the anomalies gate.
 */
export async function openMonthForUser(
    userId: string,
    period: MonthPeriod,
    now: Date = new Date()
): Promise<unknown> {
    await dbConnect();
    const doc = await MonthlyApproval.findOneAndUpdate(
        { userId, year: period.year, month: period.month },
        {
            $set: { status: APPROVAL_PENDING, requestedAt: now },
            $unset: { approvedAt: '', reminderSentAt: '' },
            $setOnInsert: { userId, year: period.year, month: period.month },
        },
        { upsert: true, new: true }
    ).lean();

    const user = (await User.findById(
        userId,
        'name email'
    )) as unknown as { name: string; email: string } | null;
    if (user?.email) {
        const frontendUrl = process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL;
        await sendMonthlyApprovalRequest({
            to: user.email,
            name: user.name,
            period,
            approveUrl: `${frontendUrl}/check-in`,
        });
    }
    return doc;
}
