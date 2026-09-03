import {
    AdminWorkSessionRow,
    WorkSessionRowStatus,
} from 'shared/src/schemas/api';
import { DEFAULT_EXPECTED_WORK_HOURS } from 'shared/src/lib/defaults';
import {
    computeDayHours,
    isWithinBenevolence,
} from 'shared/src/lib/work-hours';
import {
    UserRow,
    WorkSessionRow,
    ElectiveVacationRow,
    YearlyVacationRow,
} from '@/lib/rows';
import { dateKey } from '@/lib/date-key';

/**
 * Expand a `period` + date/yeear/month selector into the local calendar days
 * it covers. Shared by the admin and the personal work-session reports so the
 * day-bucketing is identical everywhere.
 */
export function computeDaysForPeriod(
    period: 'day' | 'week' | 'month' | 'year',
    date?: string,
    year?: number,
    month?: number
): Date[] {
    const days: Date[] = [];
    if (period === 'day') {
        const d = new Date(date as string);
        d.setHours(0, 0, 0, 0);
        days.push(d);
    } else if (period === 'week') {
        const d = new Date(date as string);
        d.setHours(0, 0, 0, 0);
        const diffToMonday = (d.getDay() + 6) % 7;
        d.setDate(d.getDate() - diffToMonday);
        for (let i = 0; i < 7; i++) {
            const day = new Date(d);
            day.setDate(d.getDate() + i);
            days.push(day);
        }
    } else if (period === 'month') {
        const y = year as number;
        const m = (month as number) - 1;
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(new Date(y, m, i));
        }
    } else {
        const y = year as number;
        const daysInYear =
            (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
        for (let i = 1; i <= daysInYear; i++) {
            days.push(new Date(y, 0, i));
        }
    }
    return days;
}

export interface WorkSessionRowsContext {
    /** Local calendar days in the reported period (ascending). */
    days: Date[];
    /** Users to report rows for (typically all, or a single one for personal view). */
    users: UserRow[];
    /** All sessions within the period (active versions only). */
    sessions: WorkSessionRow[];
    /** Approved elective vacations within the period. */
    approvedVacations: ElectiveVacationRow[];
    /** Company-wide obligatory days for the relevant years. */
    yearlyTemplates: YearlyVacationRow[];
    /** Company-wide default non-working week days (overridden per-user by workDays). */
    defaultNonWorkingDays: number[];
    /** Tolerance (hours) for the benevolence/ok check. */
    toleranceHours: number;
}

/**
 * Build the work-session report rows (status, expected hours, anomaly sets)
 * shared by the admin events view and the personal history view. All DB data
 * has already been fetched; this is pure computation so both endpoints produce
 * byte-identical rows.
 */
export function buildWorkSessionRows(
    ctx: WorkSessionRowsContext
): AdminWorkSessionRow[] {
    const {
        days,
        users,
        sessions,
        approvedVacations,
        yearlyTemplates,
        defaultNonWorkingDays,
        toleranceHours,
    } = ctx;

    const sessionsByUserDay = new Map<string, WorkSessionRow[]>();
    for (const session of sessions) {
        const key = `${session.userId}:${dateKey(new Date(session.timestamp))}`;
        const list = sessionsByUserDay.get(key) ?? [];
        list.push(session);
        sessionsByUserDay.set(key, list);
    }

    const vacationByUserDay = new Set<string>();
    for (const v of approvedVacations) {
        vacationByUserDay.add(`${v.userId}:${dateKey(new Date(v.date))}`);
    }

    const obligatoryDaySet = new Set<string>();
    for (const template of yearlyTemplates) {
        for (const day of template.obligatoryDays ?? []) {
            obligatoryDaySet.add(dateKey(new Date(day)));
        }
    }

    const rows: AdminWorkSessionRow[] = [];

    for (const day of days) {
        const key = dateKey(day);
        const dow = day.getDay();

        for (const user of users) {
            const userSessions =
                sessionsByUserDay.get(`${user._id}:${key}`) ?? [];
            const onVacation =
                vacationByUserDay.has(`${user._id}:${key}`) ||
                obligatoryDaySet.has(key);

            // A user's non-working week days: their own override, else company-wide.
            const nonWorkingDays =
                Array.isArray(user.workDays) && user.workDays.length > 0
                    ? user.workDays
                    : defaultNonWorkingDays;
            const isNonWorkingDay = nonWorkingDays.includes(dow);

            const expectedHours =
                user.expectedWorkHours ?? DEFAULT_EXPECTED_WORK_HOURS;
            const { totalHours, anomalies } = computeDayHours(userSessions);
            const anomalySet = new Set(anomalies);

            let status: WorkSessionRowStatus = 'anomaly';
            if (onVacation) {
                status = 'vacation';
                anomalySet.clear();
            } else if (isNonWorkingDay) {
                status = 'nonWorkingDay';
                anomalySet.clear();
            } else if (anomalySet.size > 0) {
                status = 'anomaly';
            } else if (totalHours === 0) {
                anomalySet.add('hours_short');
                status = 'anomaly';
            } else if (
                isWithinBenevolence(totalHours, expectedHours, toleranceHours)
            ) {
                status = 'ok';
            } else {
                anomalySet.add(
                    totalHours < expectedHours ? 'hours_short' : 'hours_over'
                );
                status = 'anomaly';
            }

            rows.push({
                userId: user._id.toString(),
                userName: user.name,
                date: key,
                totalHours,
                expectedHours,
                sessions: userSessions.map((s) => ({
                    ...s,
                    _id: s._id.toString(),
                })),
                status,
                anomalies: Array.from(anomalySet),
            });
        }
    }

    return rows;
}
