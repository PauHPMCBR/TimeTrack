import dbConnect from '@/lib/mongodb';
import { AppSettings } from '@/models';

export interface AppSettingsValues {
    defaultExpectedHours: number;
    benevolenceHours: number;
    toleranceHours: number;
    endOfDayHour: number;
    nonWorkingDays: number[];
}

const DEFAULTS: AppSettingsValues = {
    defaultExpectedHours: 8,
    benevolenceHours: 1,
    toleranceHours: 1,
    endOfDayHour: 20,
    nonWorkingDays: [6, 0],
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
        defaultExpectedHours:
            settings.defaultExpectedHours ?? DEFAULTS.defaultExpectedHours,
        benevolenceHours:
            settings.benevolenceHours ?? DEFAULTS.benevolenceHours,
        toleranceHours:
            settings.toleranceHours ??
            settings.benevolenceHours ??
            DEFAULTS.toleranceHours,
        endOfDayHour: settings.endOfDayHour ?? DEFAULTS.endOfDayHour,
        nonWorkingDays:
            Array.isArray(settings.nonWorkingDays) &&
            settings.nonWorkingDays.length > 0
                ? settings.nonWorkingDays
                : DEFAULTS.nonWorkingDays,
    };
    cachedAt = Date.now();

    return cachedSettings;
}

export function invalidateAppSettingsCache(): void {
    cachedSettings = null;
    cachedAt = 0;
}
