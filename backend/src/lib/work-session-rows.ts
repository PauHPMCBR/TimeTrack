import {
    AdminWorkSessionRow,
    WorkSessionRowStatus,
} from 'shared/src/schemas/api';
import {
    computeDayHours,
    isWithinTolerance,
} from 'shared/src/lib/work-hours';
import {
    computeTimetableAnomalies,
    dayTimetable,
    impliedHours,
} from 'shared/src/lib/expected-timetable';
import {
    dowFromDateKey,
    addDaysToKey,
    dateKeyFromParts,
    daysInMonth,
    isValidDateKey,
    DateKey,
} from 'shared/src/lib/day-key';
import {
    resolveDayExpectedHours,
    resolveWeekTimetable,
} from 'shared/src/lib/user-overrides';
import { defaultTimetable } from 'shared/src/schemas/database';
import {
    UserRow,
    WorkSessionRow,
    ElectiveVacationRow,
    YearlyVacationRow,
} from '@/lib/rows';
import { dateKeyInTz } from '@/lib/timezone';
import type { WorkDaySourceRow } from '@/repositories/work-day-source-repository';

/**
 * Expand a `period` + date/yeear/month selector into the calendar day keys
 * (company time-zone) it covers. Shared by the admin and the personal
 * work-session reports so the day-bucketing is identical everywhere.
 */
export function computeDaysForPeriod(    period: 'day' | 'week' | 'month' | 'year',
    date?: string,
    year?: number,
    month?: number
): DateKey[] {
    if (period === 'day' || period === 'week') {
        const key: DateKey =
            date && isValidDateKey(date)
                ? (date as DateKey)
                : dateKeyInTz(new Date(date as string));
        if (period === 'day') return [key];
        const diffToMonday = (dowFromDateKey(key) + 6) % 7;
        const monday = addDaysToKey(key, -diffToMonday);
        return Array.from({ length: 7 }, (_, i) => addDaysToKey(monday, i));
    }
    if (period === 'month') {
        const n = daysInMonth(year as number, month as number);
        return Array.from({ length: n }, (_, i) =>
            dateKeyFromParts(year as number, month as number, i + 1)
        );
    }
    const y = year as number;
    const daysInYear =
        (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
    return Array.from({ length: daysInYear }, (_, i) =>
        addDaysToKey(dateKeyFromParts(y, 1, 1), i)
    );
}

export interface WorkSessionRowsContext {
    /** Calendar day keys (company time-zone) in the reported period (ascending). */
    days: DateKey[];
    /** Users to report rows for (typically all, or a single one for personal view). */
    users: UserRow[];
    /** All sessions within the period (active versions only). */
    sessions: WorkSessionRow[];
    /** Approved elective vacations within the period. */
    approvedVacations: ElectiveVacationRow[];
    /** Company-wide obligatory days for the relevant years. */
    yearlyTemplates: YearlyVacationRow[];
    /** Company-wide per-weekday expected hours (0h = non-working). */
    defaultWeeklyExpectedHours: number[];
    toleranceMinutes: number;
    timetableToleranceMinutes: number;
    /** Company IANA zone sessions are compared against (defaults to the configured one). */
    timezone?: string;
    /** Day-level sources keyed by `${userId}:${YYYY-MM-DD}`. */
    daySources?: Map<string, WorkDaySourceRow>;
}

export function daySourceMap(
    rows: WorkDaySourceRow[]
): Map<string, WorkDaySourceRow> {
    return new Map(rows.map((row) => [`${row.userId}:${row.date}`, row]));
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
        defaultWeeklyExpectedHours,
        toleranceMinutes,
        timetableToleranceMinutes,
        timezone,
        daySources,
    } = ctx;

    const sessionsByUserDay = new Map<string, WorkSessionRow[]>();
    for (const session of sessions) {
        const key = `${session.userId}:${dateKeyInTz(
            new Date(session.timestamp),
            timezone
        )}`;
        const list = sessionsByUserDay.get(key) ?? [];
        list.push(session);
        sessionsByUserDay.set(key, list);
    }

    const vacationByUserDay = new Set<string>();
    for (const v of approvedVacations) {
        // Vacations are stored as inclusive [startDate, endDate] key
        // intervals; expand each one into per-day keys.
        for (let key = v.startDate; key <= v.endDate; key = addDaysToKey(key, 1)) {
            vacationByUserDay.add(`${v.userId}:${key}`);
        }
    }

    const obligatoryDaySet = new Set<string>();
    for (const template of yearlyTemplates) {
        for (const day of template.obligatoryDays ?? []) {
            obligatoryDaySet.add(day);
        }
    }

    const rows: AdminWorkSessionRow[] = [];

    for (const key of days) {
        const dow = dowFromDateKey(key);

        for (const user of users) {
            const userSessions =
                sessionsByUserDay.get(`${user._id}:${key}`) ?? [];
            const onVacation =
                vacationByUserDay.has(`${user._id}:${key}`) ||
                obligatoryDaySet.has(key);
            const isTimetableMode = user.scheduleMode === 'timetable';
            const weekTimetable = resolveWeekTimetable(
                user,
                defaultTimetable()
            );
            const intervals = dayTimetable(weekTimetable, dow);
            const expectedHours = isTimetableMode
                ? impliedHours(intervals)
                : resolveDayExpectedHours(user, dow, defaultWeeklyExpectedHours);
            const isNonWorkingDay = isTimetableMode
                ? intervals.length === 0
                : expectedHours === 0;

            const { totalHours, overtimeHours, anomalies } =
                computeDayHours(userSessions);
            const anomalySet = new Set(anomalies);
            if (isTimetableMode && intervals.length > 0) {
                for (const anomaly of computeTimetableAnomalies(
                    userSessions,
                    intervals,
                    timetableToleranceMinutes,
                    timezone
                )) {
                    anomalySet.add(anomaly);
                }
            }

            let status: WorkSessionRowStatus = 'anomaly';
            if (onVacation) {
                status = 'vacation';
                anomalySet.clear();
            } else if (isNonWorkingDay) {
                status = 'nonWorkingDay';
                anomalySet.clear();
            } else if (anomalySet.size > 0) {
                status = 'anomaly';
            } else if (isTimetableMode) {
                status = 'ok';
            } else if (totalHours === 0) {
                anomalySet.add('hours_short');
                status = 'anomaly';
            } else {
                // Overtime-flagged hours are declared beyond the expected
                // band: only the regular part is compared to it.
                const regularHours = totalHours - overtimeHours;
                if (
                    isWithinTolerance(
                        regularHours,
                        expectedHours,
                        toleranceMinutes
                    )
                ) {
                    status = 'ok';
                } else {
                    anomalySet.add(
                        regularHours < expectedHours ? 'hours_short' : 'hours_over'
                    );
                    status = 'anomaly';
                }
            }

            rows.push({
                userId: user._id.toString(),
                userName: user.name,
                date: key,
                totalHours,
                overtimeHours,
                expectedHours,
                ...(isTimetableMode && intervals.length > 0
                    ? { timetable: intervals }
                    : {}),
                ...(daySources?.has(`${user._id.toString()}:${key}`)
                    ? {
                          source: daySources.get(
                              `${user._id.toString()}:${key}`
                          )!.source,
                      }
                    : {}),
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
