import dbConnect from '@/lib/mongodb';
import {
    MonthlyApproval,
    MonthlyApprovalEvent,
    User,
    AppSettings,
    WorkDayRecord,
} from '@/models';
import {
    ADMIN_ROLE,
    APPROVAL_APPROVED,
    APPROVAL_EVENT_OPENED,
    APPROVAL_PENDING,
    MS_PER_DAY,
} from 'shared/src/lib/constants';
import type { WorkSessionAnomaly } from 'shared/src/schemas/api';
import { getAppSettings, invalidateAppSettingsCache } from '@/lib/settings';
import {
    sendAdminMonthlyReview,
    sendMonthlyApprovalReminder,
    sendMonthlyApprovalRequest,
} from '@/lib/mail';
import { getFrontendUrl } from '@/lib/frontend-url';
import {
    dateKeyFromParts,
    daysInMonth,
    DateKey,
} from 'shared/src/lib/day-key';
import { dateKey } from '@/lib/date-key';

export interface MonthPeriod {
    year: number;
    month: number; // 1-12
}

/** "YYYY-MM" key of a Date (company time-zone). */
export function monthKeyOf(d: Date): string {
    return dateKey(d).slice(0, 7);
}

/** The calendar month before the month of `d` (company time-zone). */
export function previousMonthOf(d: Date): MonthPeriod {
    const [year, month] = dateKey(d)
        .split('-')
        .slice(0, 2)
        .map(Number);
    return month === 1
        ? { year: year - 1, month: 12 }
        : { year, month: month - 1 };
}

/** True when (year, month) is a fully elapsed calendar month (company time-zone). */
export function isPastMonth(year: number, month: number, now: Date): boolean {
    const [currentYear, currentMonth] = dateKey(now)
        .split('-')
        .slice(0, 2)
        .map(Number);
    const current = currentYear * 12 + currentMonth;
    const target = year * 12 + month;
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
 * Distinct anomalies across the month, read from the cached WorkDayRecord
 * anomaly lists. Days before the user's tracking start have no record and are
 * skipped.
 */
export async function computeMonthAnomalies(
    userId: string,
    year: number,
    month: number
): Promise<WorkSessionAnomaly[]> {
    await dbConnect();
    const [user] = (await Promise.all([
        User.findById(userId, 'trackingStartDate checkInRequired').lean(),
    ])) as unknown as [
        {
            trackingStartDate?: DateKey | null;
            checkInRequired?: boolean;
        } | null,
    ];
    if (!user) return [];
    if (user.checkInRequired === false) return [];

    const nDaysInMonth = daysInMonth(year, month);
    const monthKeys: DateKey[] = Array.from({ length: nDaysInMonth }, (_, i) =>
        dateKeyFromParts(year, month, i + 1)
    );

    // Only evaluate days from the user's tracking start onward (if known).
    const trackingStartKey = user.trackingStartDate ?? null;
    const keys = trackingStartKey
        ? monthKeys.filter((key) => key >= trackingStartKey)
        : monthKeys;
    if (keys.length === 0) return [];

    const records = (await WorkDayRecord.find({
        userId,
        date: { $gte: keys[0], $lte: keys[keys.length - 1] },
    }).lean()) as unknown as { date: DateKey; anomalies?: WorkSessionAnomaly[] }[];

    const recordByDate = new Map(records.map((r) => [r.date, r]));
    const anomalySet = new Set<WorkSessionAnomaly>();
    for (const key of keys) {
        const record = recordByDate.get(key);
        if (!record) continue;
        for (const anomaly of record.anomalies ?? []) {
            anomalySet.add(anomaly);
        }
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
    const frontendUrl = getFrontendUrl();
    const reviewUrl = `${frontendUrl}/admin/monthly-approvals?year=${period.year}&month=${period.month}`;

    const admins = (await User.find(
        { role: ADMIN_ROLE, registered: true, deleted: { $ne: true } },
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
    const frontendUrl = getFrontendUrl();
    for (const doc of pending) {
        const user = (await User.findById(
            doc.userId,
            'name email emailEncrypted deleted'
        )) as unknown as {
            name: string;
            email: string;
            deleted?: boolean;
        } | null;
        if (!user?.email || user.deleted) continue;

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
 * checked the anomalies gate. A failed email does not throw: the doc must
 * exist so the worker can confirm; the caller reports `emailSent` so the
 * admin knows the worker was not actually notified.
 * `openedBy` is the acting admin's id — persisted on the doc and on the
 * append-only event history so the action is attributable.
 */
export async function openMonthForUser(
    userId: string,
    period: MonthPeriod,
    openedBy: string,
    now: Date = new Date()
): Promise<{ doc: unknown; emailSent: boolean }> {
    await dbConnect();
    const doc = await MonthlyApproval.findOneAndUpdate(
        { userId, year: period.year, month: period.month },
        {
            $set: {
                status: APPROVAL_PENDING,
                requestedAt: now,
                openedBy,
            },
            $unset: { approvedAt: '', reminderSentAt: '' },
            $setOnInsert: { userId, year: period.year, month: period.month },
        },
        { upsert: true, new: true }
    ).lean();

    await MonthlyApprovalEvent.create({
        userId,
        year: period.year,
        month: period.month,
        action: APPROVAL_EVENT_OPENED,
        actorId: openedBy,
        timestamp: now,
    });

    const user = (await User.findById(
        userId,
        'name email emailEncrypted'
    )) as unknown as { name: string; email: string } | null;
    if (user?.email) {
        const frontendUrl = getFrontendUrl();
        try {
            await sendMonthlyApprovalRequest({
                to: user.email,
                name: user.name,
                period,
                approveUrl: `${frontendUrl}/check-in`,
            });
        } catch (error) {
            console.error(
                `Failed to send monthly approval request to user ${userId}:`,
                error
            );
            return { doc, emailSent: false };
        }
    }
    return { doc, emailSent: !!user?.email };
}
