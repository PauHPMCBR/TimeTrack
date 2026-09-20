import { ElectiveVacation, YearlyVacationDays } from '@/models';
import type { YearlyVacationRow } from '@/lib/rows';

// Live vacation intervals overlapping the inclusive day-key window. Keys
// compare lexicographically. `statuses` narrows the workflow state (default:
// any status); `userId` scopes to one user or an $in list; `endExclusive`
// compares the interval starts with $lt (half-open month windows). Returns
// the query so callers can chain sort/lean.
export const findOverlapping = (
    startKey: string,
    endKey: string,
    options: {
        userId?: string | { $in: string[] };
        statuses?: string | string[];
        endExclusive?: boolean;
    } = {}
) =>
    ElectiveVacation.find({
        ...(options.userId !== undefined ? { userId: options.userId } : {}),
        ...(options.statuses !== undefined
            ? {
                  status: Array.isArray(options.statuses)
                      ? { $in: options.statuses }
                      : options.statuses,
              }
            : {}),
        startDate: options.endExclusive ? { $lt: endKey } : { $lte: endKey },
        endDate: { $gte: startKey },
    });

// Company-wide template row for a year (userId absent).
export const findGlobalTemplate = (year: number) =>
    YearlyVacationDays.findOne({ year, userId: { $exists: false } });

// Company-wide template rows for one year or a set of years.
export const findGlobalTemplates = (years: number | number[]) =>
    YearlyVacationDays.find({
        userId: { $exists: false },
        year: Array.isArray(years) ? { $in: years } : years,
    });

// Mongo appends an `_id` to every embedded interval, so compare only the
// semantic fields when checking whether a per-user config drifted.
const intervalSignature = (
    intervals:
        | { startDate: string; endDate: string; notes?: string }[]
        | undefined
) =>
    JSON.stringify(
        (intervals ?? []).map(({ startDate, endDate, notes }) => ({
            startDate,
            endDate,
            notes: notes ?? '',
        }))
    );

// Creates the per-user yearly config from the global template when missing.
// With `sync`, an existing row is updated when it drifted from the template
// (elective total or obligatory days changed). Returns null when the year has
// no global template, so callers can reject the request.
export const ensureUserYearConfig = async (
    userId: string,
    year: number,
    options: { sync?: boolean } = {}
): Promise<YearlyVacationRow | null> => {
    const userConfig: YearlyVacationRow | null =
        await YearlyVacationDays.findOne({ year, userId });

    if (!userConfig) {
        const globalConfig = await findGlobalTemplate(year);
        if (!globalConfig) return null;
        return await YearlyVacationDays.create({
            userId,
            year: globalConfig.year,
            obligatoryIntervals: globalConfig.obligatoryIntervals,
            electiveDaysTotalCount: globalConfig.electiveDaysTotalCount,
        });
    }

    if (options.sync) {
        const globalConfig = await findGlobalTemplate(year);
        if (globalConfig) {
            let hasChanges = false;

            if (
                userConfig.electiveDaysTotalCount !==
                globalConfig.electiveDaysTotalCount
            ) {
                userConfig.electiveDaysTotalCount =
                    globalConfig.electiveDaysTotalCount;
                hasChanges = true;
            }

            if (
                intervalSignature(userConfig.obligatoryIntervals) !==
                intervalSignature(globalConfig.obligatoryIntervals)
            ) {
                userConfig.obligatoryIntervals =
                    globalConfig.obligatoryIntervals;
                hasChanges = true;
            }

            if (hasChanges) {
                await YearlyVacationDays.findByIdAndUpdate(
                    userConfig._id,
                    {
                        electiveDaysTotalCount:
                            userConfig.electiveDaysTotalCount,
                        obligatoryIntervals: userConfig.obligatoryIntervals,
                    }
                );
            }
        }
    }

    return userConfig;
};
