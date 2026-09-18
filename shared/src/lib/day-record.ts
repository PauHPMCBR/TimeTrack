import type { WorkSessionAnomaly } from '../schemas/api';
import type {
    AutoScheduleEntry,
    ScheduleMode,
    WeekTimetable,
    WorkDayCheckMode,
    WorkDayClassification,
} from '../schemas/database';
import {
    computeDayHours,
    isWithinTolerance,
    DaySessionLike,
} from './work-hours';
import {
    computeTimetableAnomalies,
    dayTimetable,
    impliedHours,
} from './expected-timetable';
import {
    resolveDayExpectedHours,
    resolveWeekTimetable,
} from './user-overrides';
import { defaultTimetable } from '../schemas/database';

export interface WorkDayExpectations {
    classification: WorkDayClassification;
    checkMode: WorkDayCheckMode;
    timetableIntervals: AutoScheduleEntry[];
    expectedHours: number;
    toleranceMinutes: number;
    timetableToleranceMinutes: number;
}

/**
 * The expectations a workday must be checked against, resolved from company
 * settings + user overrides at the moment the day is recorded (or planned).
 */
export function resolveDayExpectations(
    user: {
        scheduleMode?: ScheduleMode;
        timetable?: WeekTimetable;
        weeklyExpectedHours?: number[];
    },
    settings: {
        defaultWeeklyExpectedHours: number[];
        toleranceMinutes: number;
        timetableToleranceMinutes: number;
    },
    dow: number
): WorkDayExpectations {
    const isTimetableMode = user.scheduleMode === 'timetable';
    const weekTimetable = resolveWeekTimetable(user, defaultTimetable());
    const intervals = dayTimetable(weekTimetable, dow);
    const expectedHours = isTimetableMode
        ? impliedHours(intervals)
        : resolveDayExpectedHours(user, dow, settings.defaultWeeklyExpectedHours);
    const isNonWorking = isTimetableMode
        ? intervals.length === 0
        : expectedHours === 0;
    return {
        classification: isNonWorking ? 'nonWorkingWeekday' : 'workday',
        checkMode: isTimetableMode ? 'timetable' : 'hours',
        timetableIntervals: isTimetableMode ? intervals : [],
        expectedHours: isTimetableMode ? 0 : expectedHours,
        toleranceMinutes: settings.toleranceMinutes,
        timetableToleranceMinutes: settings.timetableToleranceMinutes,
    };
}

/**
 * One day's sessions judged against the frozen expectations of its record (or
 * the live expectations of a planned day).
 */
export function computeWorkDayAnomalies(
    sessions: DaySessionLike[],
    expectations: WorkDayExpectations,
    timezone: string,
    options: { countOpenUntil?: Date } = {}
): WorkSessionAnomaly[] {
    if (expectations.classification !== 'workday') {
        return sessions.length > 0 ? ['work_on_non_working_day'] : [];
    }

    const { totalHours, overtimeHours, anomalies } = computeDayHours(
        sessions,
        options
    );
    const anomalySet = new Set<WorkSessionAnomaly>(anomalies);

    if (
        expectations.checkMode === 'timetable' &&
        expectations.timetableIntervals.length > 0
    ) {
        for (const anomaly of computeTimetableAnomalies(
            sessions,
            expectations.timetableIntervals,
            expectations.timetableToleranceMinutes,
            timezone
        )) {
            anomalySet.add(anomaly);
        }
    } else if (anomalySet.size === 0) {
        if (expectations.expectedHours === 0) {
            anomalySet.add('hours_short');
        } else {
            const regularHours = totalHours - overtimeHours;
            if (regularHours === 0) {
                anomalySet.add('hours_short');
            } else if (!isWithinTolerance(
                regularHours,
                expectations.expectedHours,
                expectations.toleranceMinutes
            )) {
                anomalySet.add(
                    regularHours < expectations.expectedHours
                        ? 'hours_short'
                        : 'hours_over'
                );
            }
        }
    }

    return Array.from(anomalySet);
}
