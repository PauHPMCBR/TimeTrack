import dbConnect from '@/lib/mongodb';
import { AppSettings } from '@/models';
import {
    defaultWeeklyExpectedHours,
    DEFAULT_END_OF_DAY_HOUR,
    DEFAULT_MONTHLY_APPROVAL_REMINDER_DAYS,
    DEFAULT_TIMETABLE_TOLERANCE_MINUTES,
    DEFAULT_TIMEZONE,
    DEFAULT_TOLERANCE_MINUTES,
} from 'shared/src/lib/defaults';
import {
    defaultTimetable,
    InconsistencyReminderMode,
    InconsistencyReminderModeSchema,
    ScheduleMode,
    WeekTimetable,
} from 'shared/src/schemas/database';

export { DEFAULT_TIMEZONE };

export interface AppSettingsValues {
    defaultWeeklyExpectedHours: number[];
    toleranceMinutes: number;
    defaultScheduleMode: ScheduleMode;
    defaultTimetable: WeekTimetable;
    timetableToleranceMinutes: number;
    endOfDayHour: number;
    inconsistencyReminderMode: InconsistencyReminderMode;
    monthlyApprovalReminderDays: number;
    timezone?: string;
    // Worker-facing privacy notice (RGPD arts. 13-14). Empty = not configured.
    privacyNoticeText?: string;
}

const DEFAULTS: AppSettingsValues = {
    defaultWeeklyExpectedHours: defaultWeeklyExpectedHours(),
    toleranceMinutes: DEFAULT_TOLERANCE_MINUTES,
    defaultScheduleMode: 'hours',
    defaultTimetable: defaultTimetable(),
    timetableToleranceMinutes: DEFAULT_TIMETABLE_TOLERANCE_MINUTES,
    endOfDayHour: DEFAULT_END_OF_DAY_HOUR,
    inconsistencyReminderMode: 'forced',
    monthlyApprovalReminderDays: DEFAULT_MONTHLY_APPROVAL_REMINDER_DAYS,
    timezone: DEFAULT_TIMEZONE,
};

const CACHE_TTL_MS = 60 * 1000;
let cachedSettings: AppSettingsValues | null = null;
let cachedAt = 0;

/**
 * Returns the company-wide settings document, lazily creating it (with the
 * defaults) on first access. A singleton is enforced by always reading the
 * first document in the collection. Results are cached for a short TTL since
 * settings are near-static; call invalidateAppSettingsCache() after writes.
 */
export async function getAppSettings(): Promise<AppSettingsValues> {
    if (cachedSettings && Date.now() - cachedAt < CACHE_TTL_MS) {
        return cachedSettings;
    }

    await dbConnect();

    let settings = await AppSettings.findOne({});
    if (!settings) {
        settings = await AppSettings.create(DEFAULTS);
    }

    cachedSettings = {
        defaultWeeklyExpectedHours: Array.isArray(
            settings.defaultWeeklyExpectedHours
        )
            ? [...settings.defaultWeeklyExpectedHours]
            : DEFAULTS.defaultWeeklyExpectedHours,
        toleranceMinutes:
            settings.toleranceMinutes ?? DEFAULTS.toleranceMinutes,
        defaultScheduleMode:
            settings.defaultScheduleMode ?? DEFAULTS.defaultScheduleMode,
        defaultTimetable: Array.isArray(settings.defaultTimetable)
            ? (settings.defaultTimetable as WeekTimetable).map((day) =>
                  day.map((entry) => ({ ...entry }))
              )
            : DEFAULTS.defaultTimetable,
        timetableToleranceMinutes:
            settings.timetableToleranceMinutes ??
            DEFAULTS.timetableToleranceMinutes,
        endOfDayHour: settings.endOfDayHour ?? DEFAULTS.endOfDayHour,
        inconsistencyReminderMode:
            InconsistencyReminderModeSchema.catch('forced').parse(
                settings.inconsistencyReminderMode
            ),
        monthlyApprovalReminderDays:
            settings.monthlyApprovalReminderDays ??
            DEFAULTS.monthlyApprovalReminderDays,
        timezone: settings.timezone ?? DEFAULTS.timezone,
        privacyNoticeText: settings.privacyNoticeText ?? '',
    };
    cachedAt = Date.now();

    return cachedSettings;
}

export function invalidateAppSettingsCache(): void {
    cachedSettings = null;
    cachedAt = 0;
}

/**
 * Synchronous accessor for the configured company time-zone (used by the
 * date-bucketing helpers). Returns the cached value when available, otherwise
 * the default This avoids making the synchronous date-range
 * helpers async while keeping every bucket consistent with AppSettings.
 */
export function getConfiguredTimezone(): string {
    return cachedSettings?.timezone ?? DEFAULT_TIMEZONE;
}
