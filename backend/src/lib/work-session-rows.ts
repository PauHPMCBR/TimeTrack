import {
    AdminWorkSessionRow,
    WorkSessionRowStatus,
} from 'shared/src/schemas/api';
import { computeDayHours } from 'shared/src/lib/work-hours';
import { impliedHours } from 'shared/src/lib/expected-timetable';
import {
    dowFromDateKey,
    addDaysToKey,
    dateKeyFromParts,
    daysInMonth,
    isValidDateKey,
    DateKey,
} from 'shared/src/lib/day-key';
import {
    computeWorkDayAnomalies,
    resolveDayExpectations,
} from 'shared/src/lib/day-record';
import { expandIntervalsToDayKeys } from 'shared/src/lib/vacation-days';
import type {
    WorkDayClassification,
    WorkSessionAnomaly,
} from 'shared/src/schemas/database';
import {
    UserRow,
    DaySessionsRow,
    ElectiveVacationRow,
    YearlyVacationRow,
    AuthorizedLeaveRow,
    WorkDayRecordRow,
} from '@/lib/rows';
import { nowWallClock } from '@/lib/timezone';

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
                : nowWallClock().date;
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
    /** Active day documents within the period. */
    daySessions: DaySessionsRow[];
    /** Approved elective vacations within the period. */
    approvedVacations: ElectiveVacationRow[];
    /** Company-wide obligatory days for the relevant years. */
    yearlyTemplates: YearlyVacationRow[];
    authorizedLeaves: AuthorizedLeaveRow[];
    records: Map<string, WorkDayRecordRow>;
    /** Company-wide per-weekday expected hours (0h = non-working). */
    defaultWeeklyExpectedHours: number[];
    toleranceMinutes: number;
    timetableToleranceMinutes: number;
    /** Latest day that has fully closed. */
    closedThrough?: DateKey;
}

export function workDayRecordMap(
    rows: WorkDayRecordRow[]
): Map<string, WorkDayRecordRow> {
    return new Map(rows.map((row) => [`${row.userId}:${row.date}`, row]));
}

const STATUS_BY_CLASSIFICATION: Record<
    WorkDayClassification,
    WorkSessionRowStatus | null
> = {
    workday: null,
    nonWorkingWeekday: 'nonWorkingDay',
    electiveVacation: 'electiveVacation',
    obligatoryVacation: 'obligatoryVacation',
    authorizedLeave: 'authorizedLeave',
};

function plannedClassification(
    userId: string,
    key: DateKey,
    base: WorkDayClassification,
    sets: {
        elective: Set<string>;
        obligatory: Set<DateKey>;
        leave: Set<string>;
    }
): WorkDayClassification {
    if (sets.leave.has(`${userId}:${key}`)) return 'authorizedLeave';
    if (sets.obligatory.has(key)) return 'obligatoryVacation';
    if (sets.elective.has(`${userId}:${key}`)) return 'electiveVacation';
    return base;
}

/**
 * Build the work-session report rows (status, expected hours, anomaly sets)
 * shared by the admin events view and the personal history view.
 */
export function buildWorkSessionRows(
    ctx: WorkSessionRowsContext
): AdminWorkSessionRow[] {
    const {
        days,
        users,
        daySessions,
        approvedVacations,
        yearlyTemplates,
        authorizedLeaves,
        records,
        defaultWeeklyExpectedHours,
        toleranceMinutes,
        timetableToleranceMinutes,
        closedThrough,
    } = ctx;

    const dayDocByUserDay = new Map<string, DaySessionsRow>();
    for (const dayDoc of daySessions) {
        dayDocByUserDay.set(`${dayDoc.userId}:${dayDoc.date}`, dayDoc);
    }

    const elective = new Set<string>();
    for (const vacation of approvedVacations) {
        for (const key of expandIntervalsToDayKeys([vacation])) {
            elective.add(`${vacation.userId}:${key}`);
        }
    }
    const obligatory = new Set(
        yearlyTemplates.flatMap((template) =>
            expandIntervalsToDayKeys(template.obligatoryIntervals ?? [])
        )
    );
    const leave = new Set<string>();
    for (const authorizedLeave of authorizedLeaves) {
        for (const key of expandIntervalsToDayKeys([authorizedLeave])) {
            leave.add(`${authorizedLeave.userId}:${key}`);
        }
    }
    const sets = { elective, obligatory, leave };

    const rows: AdminWorkSessionRow[] = [];

    for (const key of days) {
        const dow = dowFromDateKey(key);

        for (const user of users) {
            // Workers only appear from the day their tracking starts.
            if (user.trackingStartDate && key < user.trackingStartDate) {
                continue;
            }

            const userKey = `${user._id}:${key}`;
            const dayDoc = dayDocByUserDay.get(userKey);
            const userSessions = dayDoc?.sessions ?? [];
            const record = records.get(userKey);
            const { totalHours, overtimeHours } = computeDayHours(userSessions);

            let status: WorkSessionRowStatus;
            let dayClassification: WorkDayClassification;
            let expectedHours: number;
            let intervals: { checkIn: string; checkOut: string }[];
            let anomalies: WorkSessionAnomaly[];

            if (record) {
                dayClassification = record.classification;
                intervals =
                    dayClassification === 'workday'
                        ? (record.timetableIntervals ?? [])
                        : [];
                expectedHours =
                    dayClassification === 'workday'
                        ? record.checkMode === 'timetable' &&
                          intervals.length > 0
                            ? impliedHours(intervals)
                            : record.expectedHours
                        : 0;
                anomalies = record.anomalies;
                status = anomalies.length
                    ? 'anomaly'
                    : (STATUS_BY_CLASSIFICATION[dayClassification] ?? 'ok');
            } else {
                const base = resolveDayExpectations(
                    user,
                    {
                        defaultWeeklyExpectedHours,
                        toleranceMinutes,
                        timetableToleranceMinutes,
                    },
                    dow
                );
                dayClassification = plannedClassification(
                    user._id.toString(),
                    key,
                    base.classification,
                    sets
                );
                const isWorkday = dayClassification === 'workday';
                intervals =
                    isWorkday && base.checkMode === 'timetable'
                        ? base.timetableIntervals
                        : [];
                expectedHours = isWorkday
                    ? base.checkMode === 'timetable' && intervals.length > 0
                        ? impliedHours(intervals)
                        : base.expectedHours
                    : 0;

                const isClosed =
                    closedThrough !== undefined && key <= closedThrough;

                if (isClosed) {
                    // The day closed but its record is missing (e.g. the
                    // day-close job never ran): judge it live instead of
                    // showing it as "awaiting close" forever.
                    anomalies = computeWorkDayAnomalies(
                        userSessions,
                        {
                            ...base,
                            classification: dayClassification,
                            timetableIntervals: intervals,
                            expectedHours,
                        },
                        { countOpenUntil: '24:00' }
                    );
                    status = anomalies.length
                        ? 'anomaly'
                        : (STATUS_BY_CLASSIFICATION[dayClassification] ??
                          'ok');
                } else {
                    status = isWorkday
                        ? 'planned'
                        : (STATUS_BY_CLASSIFICATION[dayClassification] ??
                          'planned');
                    anomalies = [];
                }
            }

            rows.push({
                userId: user._id.toString(),
                userName: user.name,
                date: key,
                totalHours,
                overtimeHours,
                expectedHours,
                ...(intervals.length > 0 ? { timetable: intervals } : {}),
                ...(dayDoc ? { source: dayDoc.source } : {}),
                ...(dayDoc?.editedBy ? { editedBy: dayDoc.editedBy } : {}),
                ...(dayDoc?.editReason ? { editReason: dayDoc.editReason } : {}),
                ...(dayDoc?.createdAt ? { createdAt: dayDoc.createdAt } : {}),
                sessions: userSessions,
                status,
                dayClassification,
                anomalies,
            });
        }
    }

    return rows;
}
