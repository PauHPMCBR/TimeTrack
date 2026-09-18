import dbConnect from '@/lib/mongodb';
import { User } from '@/models';
import { findActiveInRange } from '@/repositories/work-session-repository';
import { findOneWorkDayRecord } from '@/repositories/work-day-record-repository';
import { ensureWorkDayRecordsForDay } from '@/lib/work-day-records';
import { getAppSettings } from '@/lib/settings';
import { dateKey } from '@/lib/date-key';
import type { DateKey } from 'shared/src/lib/day-key';
import { dayRange, dayTimestamp } from '@/lib/date-range';
import {
    runMonthlyAdminReview,
    runMonthlyApprovalReminders,
} from '@/lib/monthly-approvals';
import {
    getAutoTimetable,
    AutoScheduleEntry,
} from '@/lib/auto-schedule';
import { sendInconsistencyReminder } from '@/lib/mail';
import { MS_PER_MINUTE } from 'shared/src/lib/constants';
import { getFrontendUrl } from '@/lib/frontend-url';
import { formatTime } from '@/lib/timezone';

interface ReminderUser {
    _id: string;
    email: string;
    name: string;
    autoTimetable?: AutoScheduleEntry[];
    lastInconsistencyReminder?: string;
    checkInRequired?: boolean;
    notifyInconsistency?: boolean;
}

/** "09:00 – 13:00, 15:00 – 19:00" — human-readable timetable for the email. */
function formatTimetable(timetable: AutoScheduleEntry[]): string {
    return timetable
        .map((entry) => `${entry.checkIn} – ${entry.checkOut}`)
        .join(', ');
}

export interface ReminderSummary {
    date: string;
    scannedUsers: number;
    sentEmails: number;
    sentTo: string[];
    disabled?: boolean;
}

/**
 * Emails every registered user whose WorkDayRecord for the day carries cached
 * anomalies, at most once per day (lastInconsistencyReminder date key) so
 * cron retries and restarts are safe. Respects the company's
 * `inconsistencyReminderMode` setting ('disabled' = no-op).
 */
export async function runDailyInconsistencyReminder(
    dateKeyStr: DateKey = dateKey(new Date())
): Promise<ReminderSummary> {
    await dbConnect();
    const settings = await getAppSettings();

            if (settings.inconsistencyReminderMode === 'disabled') {
        return {
            date: dateKeyStr,
            scannedUsers: 0,
            sentEmails: 0,
            sentTo: [],
            disabled: true,
        };
    }

    const { start, end } = dayRange(dateKeyStr);

    const users = (await User.find(
        { registered: true, deleted: { $ne: true }, checkInRequired: { $ne: false } },
        'name email emailEncrypted autoTimetable lastInconsistencyReminder checkInRequired notifyInconsistency'
    ).lean()) as unknown as ReminderUser[];
    const sentTo: string[] = [];

    for (const user of users) {
        if (
            settings.inconsistencyReminderMode === 'user_choice' &&
            user.notifyInconsistency === false
        )
            continue;

        const record = (await findOneWorkDayRecord(
            user._id.toString(),
            dateKeyStr
        ).lean()) as unknown as {
            anomalies?: import('shared/src/schemas/database').WorkSessionAnomaly[];
        } | null;
        const anomalies = record?.anomalies ?? [];
        if (anomalies.length === 0) continue;
        if (user.lastInconsistencyReminder === dateKeyStr) continue;

        const sessions = (await findActiveInRange(start, end, {
            userId: user._id.toString(),
        })
            .sort({ timestamp: 1 })
            .lean()) as unknown as {
            timestamp: Date | string;
            type: 'check_in' | 'check_out';
        }[];

        const timetable = getAutoTimetable(user);
        const autoTimetable = formatTimetable(timetable);
        const times = sessions.map((s) => ({
            time: formatTime(new Date(s.timestamp)),
            type: s.type,
        }));
        const frontendUrl = getFrontendUrl();
        const applyAutoUrl = `${frontendUrl}/check-in?applyAuto=1&date=${dateKeyStr}`;

        await sendInconsistencyReminder({
            to: user.email,
            name: user.name,
            date: dateKeyStr,
            anomalies,
            times,
            autoTimetable,
            applyAutoUrl,
        });

        await User.updateOne(
            { _id: user._id },
            {
                lastInconsistencyReminder: dateKeyStr,
                updatedAt: new Date(),
            }
        );

        sentTo.push(user.email);
    }

    return {
        date: dateKeyStr,
        scannedUsers: users.length,
        sentEmails: sentTo.length,
        sentTo,
    };
}

const CHECK_INTERVAL_MS = 5 * MS_PER_MINUTE;

/**
 * In-process daily scheduler. Reads the end-of-day hour, non-working days and
 * the inconsistency-reminder toggle from the company settings (DB) on every
 * tick, so admin changes to `endOfDayHour` / `inconsistencyReminderMode` are
 * picked up without touching any cron. Started from instrumentation.ts.
 */
export function scheduleDailyReminder(): void {
    let lastRunDay: string | null = null;
    let running = false;

    const tick = async () => {
        if (running) return;
        running = true;
        try {
            const settings = await getAppSettings();
            const now = new Date();
            const todayKey = dateKey(now);

            // Monthly record confirmation jobs run regardless of working days:
            // the admin review mail fires once per month; approval reminders
            // are checked daily against their requestedAt.
            await runMonthlyAdminReview(now);
            await runMonthlyApprovalReminders(now);

            if (lastRunDay === todayKey) return;

            const endOfDay = dayTimestamp(
                todayKey,
                `${String(settings.endOfDayHour).padStart(2, '0')}:00`
            );

            if (now.getTime() >= endOfDay.getTime()) {
                lastRunDay = todayKey;
                await ensureWorkDayRecordsForDay(todayKey);
                await runDailyInconsistencyReminder(todayKey);
            }
        } catch (error) {
            console.error('[reminders] scheduler tick failed:', error);
        } finally {
            running = false;
        }
    };

    tick();
    setInterval(tick, CHECK_INTERVAL_MS);
}