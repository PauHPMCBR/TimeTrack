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
import { resolveDayExpectations } from 'shared/src/lib/day-record';
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
    } = ctx;

    const dayDocByUserDay = new Map<string, DaySessionsRow>();
    for (const dayDoc of daySessions) {
        dayDocByUserDay.set(`${dayDoc.userId}:${dayDoc.date}`, dayDoc);
    }

    const sets = {
        elective: new Set<string>(),
        obligatory: new Set<DateKey>(),
        leave: new Set<string>(),
    };
    for (const v of approvedVacations) {
        for (let key = v.startDate; key <= v.endDate; key = addDaysToKey(key, 1)) {
            sets.elective.add(`${v.userId}:${key}`);
        }
    }
    for (const template of yearlyTemplates) {
        for (const day of template.obligatoryDays ?? []) {
            sets.obligatory.add(day);
        }
    }
    for (const leave of authorizedLeaves) {
        for (let key = leave.startDate; key <= leave.endDate; key = addDaysToKey(key, 1)) {
            sets.leave.add(`${leave.userId}:${key}`);
        }
    }

    const rows: AdminWorkSessionRow[] = [];

    for (const key of days) {
        const dow = dowFromDateKey(key);

        for (const user of users) {
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
                intervals = record.timetableIntervals ?? [];
                expectedHours =
                    record.checkMode === 'timetable' && intervals.length > 0
                        ? impliedHours(intervals)
                        : record.expectedHours;
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
                intervals = base.timetableIntervals;
                dayClassification = plannedClassification(
                    user._id.toString(),
                    key,
                    base.classification,
                    sets
                );
                expectedHours =
                    dayClassification === 'workday'
                        ? base.checkMode === 'timetable' &&
                          intervals.length > 0
                            ? impliedHours(intervals)
                            : base.expectedHours
                        : 0;
                status =
                    dayClassification === 'workday'
                        ? 'planned'
                        : STATUS_BY_CLASSIFICATION[dayClassification] ?? 'planned';
                anomalies = [];
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
