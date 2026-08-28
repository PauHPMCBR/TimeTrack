import dbConnect from '@/lib/mongodb';
import { User, WorkSession } from '@/models';
import { computeDayHours, DaySessionLike } from 'shared/src/lib/work-hours';
import { getAppSettings } from '@/lib/settings';
import { dateKey } from '@/lib/date-key';
import { dayRange } from '@/lib/date-range';
import {
    runMonthlyAdminReview,
    runMonthlyApprovalReminders,
} from '@/lib/monthly-approvals';
import {
    getAutoTimetable,
    AutoScheduleEntry,
} from '@/lib/auto-schedule';
import { sendInconsistencyReminder } from '@/lib/mail';
import { MS_PER_MINUTE, SESSION_REPLACED } from 'shared/src/lib/constants';
import {
    DEFAULT_BENEVOLENCE_HOURS,
    DEFAULT_FRONTEND_URL,
} from 'shared/src/lib/defaults';

interface ReminderUser {
    _id: string;
    email: string;
    name: string;
    expectedWorkHours?: number;
    autoTimetable?: AutoScheduleEntry[];
    lastInconsistencyReminder?: string;
}

/** "09:00 – 13:00, 15:00 – 19:00" — human-readable timetable for the email. */
function formatTimetable(timetable: AutoScheduleEntry[]): string {
    return timetable
        .map((entry) => `${entry.checkIn} – ${entry.checkOut}`)
        .join(', ');
}

/** "HH:MM" (local) wall-clock time of a session timestamp. */
function formatClockTime(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export interface ReminderSummary {
    date: string;
    scannedUsers: number;
    sentEmails: number;
    sentTo: string[];
    disabled?: boolean;
}

/**
 * Scans one day's work sessions and emails every registered user whose day is
 * inconsistent (structural anomaly such as a forgotten check-in/out, or worked
 * hours outside expected ± benevolence). Users are emailed at most once per day
 * (lastInconsistencyReminder date key) so cron retries and restarts are safe.
 * Respects the company's `inconsistencyReminderEnabled` setting (off = no-op).
 */
export async function runDailyInconsistencyReminder(
    dateKeyStr: string = dateKey(new Date())
): Promise<ReminderSummary> {
    await dbConnect();
    const settings = await getAppSettings();

    if (settings.inconsistencyReminderEnabled === false) {
        return {
            date: dateKeyStr,
            scannedUsers: 0,
            sentEmails: 0,
            sentTo: [],
            disabled: true,
        };
    }

    const { start, end } = dayRange(dateKeyStr);

    const users = (await User.find({ registered: true }).lean()) as unknown as ReminderUser[];
    const sentTo: string[] = [];

    for (const user of users) {
        const sessions = (await WorkSession.find({
            userId: user._id.toString(),
            timestamp: { $gte: start, $lt: end },
            status: { $ne: SESSION_REPLACED },
        })
            .sort({ timestamp: 1 })
            .lean()) as unknown as DaySessionLike[];

        if (sessions.length === 0) continue;

        const result = computeDayHours(sessions, {
            countOpenUntil: end,
        });
        const anomalies = [...result.anomalies];

        const expected =
            user.expectedWorkHours ?? settings.defaultExpectedHours;
        const benevolence = settings.benevolenceHours ?? DEFAULT_BENEVOLENCE_HOURS;
        if (result.totalHours < expected - benevolence) {
            anomalies.push('hours_short');
        } else if (result.totalHours > expected + benevolence) {
            anomalies.push('hours_over');
        }

        if (anomalies.length === 0) continue;
        if (user.lastInconsistencyReminder === dateKeyStr) continue;

        const timetable = getAutoTimetable(user);
        const autoTimetable = formatTimetable(timetable);
        const times = sessions.map((s) => ({
            time: formatClockTime(new Date(s.timestamp)),
            type: s.type,
        }));
        const frontendUrl = process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL;
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
 * tick, so admin changes to `endOfDayHour` / `inconsistencyReminderEnabled` are
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

            // Toggle off: skip without marking the day done, so re-enabling
            // later (still after end of day) fires for today.
            if (settings.inconsistencyReminderEnabled === false) {
                return;
            }

            // Nothing to do on non-working days; mark them done so we don't
            // retry all day.
            if (settings.nonWorkingDays.includes(now.getDay())) {
                lastRunDay = todayKey;
                return;
            }
            if (lastRunDay === todayKey) return;

            const endOfDay = new Date(now);
            endOfDay.setHours(settings.endOfDayHour, 0, 0, 0);

            if (now.getTime() >= endOfDay.getTime()) {
                lastRunDay = todayKey;
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