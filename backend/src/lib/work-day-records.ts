import dbConnect from '@/lib/mongodb';
import { AppSettings, User, YearlyVacationDays } from '@/models';
import { findActiveInRange } from '@/repositories/work-session-repository';
import { findOverlapping } from '@/repositories/vacation-repository';
import { findLeavesOverlapping } from '@/repositories/authorized-leave-repository';
import {
    findUserWorkDayRecords,
    upsertWorkDayRecord,
    type WorkDayRecordDoc,
} from '@/repositories/work-day-record-repository';
import { getAppSettings, invalidateAppSettingsCache } from '@/lib/settings';
import { dateKeyInTz } from '@/lib/timezone';
import { dayRange, dayTimestamp } from '@/lib/date-range';
import { dateKey } from '@/lib/date-key';
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
} from 'shared/src/schemas/database';
import type { DateKey } from 'shared/src/lib/day-key';
import { addDaysToKey, dowFromDateKey } from 'shared/src/lib/day-key';
import { VACATION_APPROVED } from 'shared/src/lib/constants';
import { DEFAULT_TIMEZONE } from 'shared/src/lib/defaults';
import type { WorkDayRecordRow } from '@/lib/rows';

type Settings = Awaited<ReturnType<typeof getAppSettings>>;

const timezoneOf = (settings: Settings): string =>
    settings.timezone ?? DEFAULT_TIMEZONE;

const USER_PROJECTION =
    'scheduleMode timetable weeklyExpectedHours trackingStartDate';

/**
 * The latest day that has fully closed (company time-zone): today after the
 * company's endOfDayHour, otherwise yesterday.
 */
export async function lastClosedDayKey(now: Date = new Date()): Promise<DateKey> {
    const todayKey = dateKey(now);
    const settings = await getAppSettings();
    const endOfDay = dayTimestamp(
        todayKey,
        `${String(settings.endOfDayHour).padStart(2, '0')}:00`
    );
    return now.getTime() >= endOfDay.getTime()
        ? todayKey
        : addDaysToKey(todayKey, -1);
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

function bucketSessionsByDay(
    sessions: (DaySessionLike & { timestamp: Date })[],
    timezone: string
): Map<DateKey, DaySessionLike[]> {
    const byDay = new Map<DateKey, DaySessionLike[]>();
    for (const session of sessions) {
        const key = dateKeyInTz(new Date(session.timestamp), timezone);
        const list = byDay.get(key) ?? [];
        list.push(session);
        byDay.set(key, list);
    }
    return byDay;
}

async function loadRangeData(
    userId: string,
    fromKey: DateKey,
    toKey: DateKey,
    settings: Settings
) {
    const { start } = dayRange(fromKey);
    const { end } = dayRange(addDaysToKey(toKey, 1));

    const [user, sessions, approvedVacations, templates, leaves, existing] =
        await Promise.all([
            User.findById(userId, USER_PROJECTION) as Promise<
                Record<string, unknown> | null
            >,
            findActiveInRange(start, end, { userId })
                .sort({ timestamp: 1 })
                .lean() as unknown as Promise<
                (DaySessionLike & { timestamp: Date })[]
            >,
            findOverlapping(fromKey, toKey, {
                userId,
                statuses: VACATION_APPROVED,
            }).lean() as unknown as Promise<
                { startDate: DateKey; endDate: DateKey }[]
            >,
            YearlyVacationDays.find({
                userId: { $exists: false },
                year: {
                    $gte: Number(fromKey.slice(0, 4)),
                    $lte: Number(toKey.slice(0, 4)),
                },
            }).lean() as unknown as Promise<{ obligatoryDays?: DateKey[] }[]>,
            findLeavesOverlapping(fromKey, toKey, {
                userId,
            }).lean() as unknown as Promise<
                { startDate: DateKey; endDate: DateKey }[]
            >,
            findUserWorkDayRecords(userId, fromKey, toKey).lean() as unknown as Promise<
                WorkDayRecordRow[]
            >,
        ]);
    if (!user) return null;

    return {
        user,
        sessionsByDay: bucketSessionsByDay(sessions, timezoneOf(settings)),
        sets: expandSets(approvedVacations, templates, leaves),
        existing: new Map(existing.map((r) => [r.date, r])),
    };
}

function expandSets(
    vacations: { startDate: DateKey; endDate: DateKey }[],
    templates: { obligatoryDays?: DateKey[] }[],
    leaves: { startDate: DateKey; endDate: DateKey }[]
): NonWorkdaySets {
    const elective = new Set<DateKey>();
    for (const v of vacations) {
        for (let key = v.startDate; key <= v.endDate; key = addDaysToKey(key, 1)) {
            elective.add(key);
        }
    }
    const obligatory = new Set<DateKey>();
    for (const template of templates) {
        for (const day of template.obligatoryDays ?? []) obligatory.add(day);
    }
    const leave = new Set<DateKey>();
    for (const l of leaves) {
        for (let key = l.startDate; key <= l.endDate; key = addDaysToKey(key, 1)) {
            leave.add(key);
        }
    }
    return { elective, obligatory, leave };
}

function dayDoc(
    userId: string,
    key: DateKey,
    expectations: WorkDayExpectations,
    sessions: DaySessionLike[],
    settings: Settings
): WorkDayRecordDoc {
    const anomalies: WorkSessionAnomaly[] = computeWorkDayAnomalies(
        sessions,
        expectations,
        timezoneOf(settings),
        { countOpenUntil: dayRange(key).end }
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
        writable[writable.length - 1],
        settings
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
                data.user as Parameters<typeof resolveDayExpectations>[0],
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
                    data.user as Parameters<typeof resolveDayExpectations>[0],
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
                data.sessionsByDay.get(key) ?? [],
                settings
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
    const eligible = (await User.find(
        {
            registered: true,
            deleted: { $ne: true },
            checkInRequired: { $ne: false },
        },
        '_id trackingStartDate'
    ).lean()) as unknown as { _id: string; trackingStartDate?: DateKey }[];

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
    const flagDoc = (await AppSettings.findOne(
        {},
        'dayRecordBackfillDone'
    ).lean()) as unknown as { dayRecordBackfillDone?: boolean } | null;
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
    const user = (await User.findById(
        userId,
        USER_PROJECTION
    ).lean()) as unknown as
        | ({ _id: unknown; trackingStartDate?: DateKey } & Record<string, unknown>)
        | null;
    if (!user) return 0;
    const toKey = await lastClosedDayKey();
    const from = user.trackingStartDate ?? toKey;
    if (from > toKey) return 0;
    return writeWorkDayRecords(userId, expandKeys(from, toKey), {
        onlyMissing: true,
    });
}
