import dbConnect from '@/lib/mongodb';
import type { z } from 'zod';
import { AppSettings, User, YearlyVacationDays } from '@/models';
import { findActiveDaySessions } from '@/repositories/work-day-sessions-repository';
import { findOverlapping } from '@/repositories/vacation-repository';
import { findLeavesOverlapping } from '@/repositories/authorized-leave-repository';
import {
    findUserWorkDayRecords,
    upsertWorkDayRecord,
    type WorkDayRecordDoc,
} from '@/repositories/work-day-record-repository';
import { getAppSettings, invalidateAppSettingsCache } from '@/lib/settings';
import { dateKey, timeKeyInTz } from '@/lib/date-key';
import {
    computeWorkDayAnomalies,
    resolveDayExpectations,
    type WorkDayExpectations,
} from 'shared/src/lib/day-record';
import type { DaySessionLike } from 'shared/src/lib/work-hours';
import type {
    AutoScheduleEntry,
    WorkDayCheckMode,
    WorkDayClassification,
    WorkSessionAnomaly,
    AppSettingsSchema,
} from 'shared/src/schemas/database';
import type { DateKey, DateKeyInterval } from 'shared/src/lib/day-key';
import { addDaysToKey, dowFromDateKey } from 'shared/src/lib/day-key';
import { expandIntervalsToDayKeys } from 'shared/src/lib/vacation-days';
import { VACATION_APPROVED } from 'shared/src/lib/constants';
import type {
    UserRow,
    WorkDayRecordRow,
    YearlyVacationRow,
} from '@/lib/rows';

const USER_PROJECTION =
    'scheduleMode timetable weeklyExpectedHours trackingStartDate';

/**
 * The latest day that has fully closed (company time-zone): today after the
 * company's endOfDayHour, otherwise yesterday.
 */
export async function lastClosedDayKey(now: Date = new Date()): Promise<DateKey> {
    const todayKey = dateKey(now);
    const settings = await getAppSettings();
    const endOfDay = `${String(settings.endOfDayHour).padStart(2, '0')}:00`;
    return timeKeyInTz(now) >= endOfDay ? todayKey : addDaysToKey(todayKey, -1);
}

interface NonWorkdaySets {
    elective: Set<DateKey>;
    obligatory: Set<DateKey>;
    leave: Set<DateKey>;
}

/**
 * Precedence when several overlap: authorizedLeave > obligatoryVacation >
 * electiveVacation.
 */
function classificationFor(
    expectations: WorkDayExpectations,
    sets: NonWorkdaySets,
    key: DateKey
): WorkDayExpectations {
    if (sets.leave.has(key)) {
        return { ...expectations, classification: 'authorizedLeave' };
    }
    if (sets.obligatory.has(key)) {
        return { ...expectations, classification: 'obligatoryVacation' };
    }
    if (sets.elective.has(key)) {
        return { ...expectations, classification: 'electiveVacation' };
    }
    return expectations;
}

function expandKeys(fromKey: DateKey, toKey: DateKey): DateKey[] {
    const keys: DateKey[] = [];
    for (let key = fromKey; key <= toKey; key = addDaysToKey(key, 1)) {
        keys.push(key);
    }
    return keys;
}

function daySessionsByDay(
    dayDocs: { date: DateKey; sessions: DaySessionLike[] }[]
): Map<DateKey, DaySessionLike[]> {
    const byDay = new Map<DateKey, DaySessionLike[]>();
    for (const dayDoc of dayDocs) {
        byDay.set(dayDoc.date, dayDoc.sessions);
    }
    return byDay;
}

async function findUserSchedule(
    userId: string
): Promise<
    Pick<UserRow, 'scheduleMode' | 'timetable' | 'weeklyExpectedHours'> | null
> {
    return User.findById(userId, USER_PROJECTION);
}

async function loadRangeData(
    userId: string,
    fromKey: DateKey,
    toKey: DateKey
) {
    const [user, sessions, approvedVacations, templates, leaves, existing] =
        await Promise.all([
            findUserSchedule(userId),
            findActiveDaySessions(fromKey, toKey, { userId })
                .sort({ date: 1 })
                .lean<{ date: DateKey; sessions: DaySessionLike[] }[]>(),
            findOverlapping(fromKey, toKey, {
                userId,
                statuses: VACATION_APPROVED,
            }).lean<{ startDate: DateKey; endDate: DateKey }[]>(),
            YearlyVacationDays.find({
                userId: { $exists: false },
                year: {
                    $gte: Number(fromKey.slice(0, 4)),
                    $lte: Number(toKey.slice(0, 4)),
                },
            }).lean<Pick<YearlyVacationRow, 'obligatoryIntervals'>[]>(),
            findLeavesOverlapping(fromKey, toKey, {
                userId,
            }).lean<{ startDate: DateKey; endDate: DateKey }[]>(),
            findUserWorkDayRecords(userId, fromKey, toKey).lean<
                WorkDayRecordRow[]
            >(),
        ]);
    if (!user) return null;

    return {
        user,
        sessionsByDay: daySessionsByDay(sessions),
        sets: expandSets(approvedVacations, templates, leaves),
        existing: new Map(existing.map((r) => [r.date, r])),
    };
}

function expandSets(
    vacations: DateKeyInterval[],
    templates: { obligatoryIntervals?: DateKeyInterval[] }[],
    leaves: DateKeyInterval[]
): NonWorkdaySets {
    return {
        elective: new Set(expandIntervalsToDayKeys(vacations)),
        obligatory: new Set(
            templates.flatMap((template) =>
                expandIntervalsToDayKeys(template.obligatoryIntervals ?? [])
            )
        ),
        leave: new Set(expandIntervalsToDayKeys(leaves)),
    };
}

function dayDoc(
    userId: string,
    key: DateKey,
    expectations: WorkDayExpectations,
    sessions: DaySessionLike[]
): WorkDayRecordDoc {
    const anomalies: WorkSessionAnomaly[] = computeWorkDayAnomalies(
        sessions,
        expectations,
        { countOpenUntil: '24:00' }
    );
    return {
        userId,
        date: key,
        classification: expectations.classification,
        checkMode: expectations.checkMode,
        timetableIntervals: expectations.timetableIntervals,
        expectedHours: expectations.expectedHours,
        toleranceMinutes: expectations.toleranceMinutes,
        timetableToleranceMinutes: expectations.timetableToleranceMinutes,
        anomalies,
        source: 'system',
        computedAt: new Date(),
    };
}

interface WriteOptions {
    /** Skip days that already have a record (backfills are additive). */
    onlyMissing?: boolean;
    actorId?: string;
    reason?: string;
    overrides?: {
        classification: WorkDayClassification;
        checkMode?: WorkDayCheckMode;
        timetableIntervals?: AutoScheduleEntry[];
        expectedHours?: number;
    };
}

/**
 * The single path that writes WorkDayRecords. Days after the last closed day
 * are ignored (future days stay in the planned view). Days already carrying an
 * admin override (source 'adminEdit') keep their frozen
 * classification/expectations unless explicit `overrides` are given; anomalies
 * are always recalculated from the current sessions.
 */
async function writeWorkDayRecords(
    userId: string,
    dateKeys: DateKey[],
    options: WriteOptions = {}
): Promise<number> {
    const cutoff = await lastClosedDayKey();
    const writable = [...new Set(dateKeys)]
        .sort()
        .filter((key) => key <= cutoff);
    if (writable.length === 0) return 0;
    await dbConnect();
    const settings = await getAppSettings();

    const data = await loadRangeData(
        userId,
        writable[0],
        writable[writable.length - 1]
    );
    if (!data) return 0;

    let written = 0;
    for (const key of writable) {
        const existing = data.existing.get(key);
        if (options.onlyMissing && existing) continue;
        const adminFrozen = existing?.source === 'adminEdit' && !options.overrides;

        let expectations: WorkDayExpectations;
        if (adminFrozen) {
            expectations = {
                classification: existing.classification,
                checkMode: existing.checkMode,
                timetableIntervals: existing.timetableIntervals ?? [],
                expectedHours: existing.expectedHours ?? 0,
                toleranceMinutes: existing.toleranceMinutes,
                timetableToleranceMinutes:
                    existing.timetableToleranceMinutes,
            };
        } else if (options.overrides) {
            const base = resolveDayExpectations(
                data.user,
                settings,
                dowFromDateKey(key)
            );
            const isWorkday = options.overrides.classification === 'workday';
            expectations = {
                classification: options.overrides.classification,
                checkMode: options.overrides.checkMode ?? base.checkMode,
                timetableIntervals: isWorkday
                    ? (options.overrides.timetableIntervals ??
                      base.timetableIntervals)
                    : [],
                expectedHours: isWorkday
                    ? (options.overrides.expectedHours ?? base.expectedHours)
                    : 0,
                toleranceMinutes: base.toleranceMinutes,
                timetableToleranceMinutes: base.timetableToleranceMinutes,
            };
        } else {
            expectations = classificationFor(
                resolveDayExpectations(
                    data.user,
                    settings,
                    dowFromDateKey(key)
                ),
                data.sets,
                key
            );
        }

        await upsertWorkDayRecord({
            ...dayDoc(
                userId,
                key,
                expectations,
                data.sessionsByDay.get(key) ?? []
            ),
            ...(adminFrozen
                ? {
                      source: 'adminEdit' as const,
                      editedBy: existing.editedBy,
                      editReason: existing.editReason,
                      editReasonEncrypted: existing.editReasonEncrypted,
                  }
                : {}),
            ...(options.overrides
                ? {
                      source: 'adminEdit' as const,
                      editedBy: options.actorId ?? '',
                      editReason: options.reason ?? '',
                  }
                : {}),
        });
        written++;
    }
    return written;
}

/**
 * Recomputes records for the given days of one user, rewriting them in place
 * (existing records are re-judged, not skipped).
 */
export async function recomputeWorkDayRecords(
    userId: string,
    dateKeys: DateKey[],
    options: {
        actorId?: string;
        reason?: string;
        overrides?: {
            classification: WorkDayClassification;
            checkMode?: WorkDayCheckMode;
            timetableIntervals?: AutoScheduleEntry[];
            expectedHours?: number;
        };
    } = {}
): Promise<void> {
    await writeWorkDayRecords(userId, dateKeys, options);
}

/** Interval-shaped convenience wrapper (leaves, vacations, obligatory days). */
export async function recomputeWorkDayRecordsForRange(
    userId: string,
    fromKey: DateKey,
    toKey: DateKey
): Promise<void> {
    await recomputeWorkDayRecords(userId, expandKeys(fromKey, toKey));
}

/**
 * Ensures records exist for every eligible user up to the given day; also
 * self-heals past days that are still missing their record.
 */
export async function ensureWorkDayRecordsForDay(todayKey: DateKey): Promise<number> {
    return ensureAllUserRecords(todayKey);
}

async function ensureAllUserRecords(toKey: DateKey): Promise<number> {
    await dbConnect();
    const eligible = await User.find(
        {
            registered: true,
            deleted: { $ne: true },
            checkInRequired: { $ne: false },
        },
        '_id trackingStartDate'
    ).lean<(Pick<UserRow, 'trackingStartDate'> & { _id: string })[]>();

    let created = 0;
    for (const user of eligible) {
        const from = user.trackingStartDate ?? toKey;
        if (from > toKey) continue;
        created += await writeWorkDayRecords(
            user._id.toString(),
            expandKeys(from, toKey),
            { onlyMissing: true }
        );
    }
    return created;
}

/**
 * One-time deploy backfill, guarded by AppSettings.dayRecordBackfillDone.
 */
export async function backfillAllWorkDayRecords(): Promise<number> {
    await dbConnect();
    const flagDoc = await AppSettings.findOne(
        {},
        'dayRecordBackfillDone'
    ).lean<
        Pick<z.infer<typeof AppSettingsSchema>, 'dayRecordBackfillDone'> | null
    >();
    if (flagDoc?.dayRecordBackfillDone) return 0;

    const created = await ensureAllUserRecords(await lastClosedDayKey());

    await AppSettings.updateOne(
        {},
        { $set: { dayRecordBackfillDone: true, updatedAt: new Date() } },
        { upsert: true }
    );
    invalidateAppSettingsCache();
    return created;
}

/**
 * Backfill hook for user changes: covers days from the (possibly new)
 * tracking start to the last closed day.
 */
export async function backfillUserWorkDayRecordsFromTrackingStart(
    userId: string
): Promise<number> {
    await dbConnect();
    const user = await User.findById(userId, USER_PROJECTION).lean<
        (Pick<UserRow, 'trackingStartDate'> & { _id: string }) | null
    >();
    if (!user) return 0;
    const toKey = await lastClosedDayKey();
    const from = user.trackingStartDate ?? toKey;
    if (from > toKey) return 0;
    return writeWorkDayRecords(userId, expandKeys(from, toKey), {
        onlyMissing: true,
    });
}
