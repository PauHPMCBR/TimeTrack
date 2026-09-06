import { ElectiveVacation, YearlyVacationDays } from '@/models';
import type { YearlyVacationRow } from '@/lib/rows';

// Live vacation intervals overlapping [start, end]. `statuses` narrows the
// workflow state (default: any status); `userId` scopes to one user or an
// $in list; `endExclusive` compares the interval starts with $lt (half-open
// month windows). Returns the query so callers can chain sort/lean.
export const findOverlapping = (
    start: Date,
    end: Date,
    options: {
        userId?: string | { $in: unknown[] };
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
        startDate: options.endExclusive ? { $lt: end } : { $lte: end },
        endDate: { $gte: start },
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

// Creates the per-user yearly config from the global template when missing.
// With `sync`, an existing row is updated when it drifted from the template
// (elective total or obligatory days changed). Returns null when the year has
// no global template, so callers can reject the request.
export const ensureUserYearConfig = async (
    userId: string,
    year: number,
    options: { sync?: boolean } = {}
): Promise<YearlyVacationRow | null> => {
    const userConfig = await YearlyVacationDays.findOne({ year, userId });

    if (!userConfig) {
        const globalConfig = await findGlobalTemplate(year);
        if (!globalConfig) return null;
        return (await YearlyVacationDays.create({
            userId,
            year: globalConfig.year,
            obligatoryDays: globalConfig.obligatoryDays,
            electiveDaysTotalCount: globalConfig.electiveDaysTotalCount,
        })) as unknown as YearlyVacationRow;
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
                JSON.stringify(userConfig.obligatoryDays) !==
                JSON.stringify(globalConfig.obligatoryDays)
            ) {
                userConfig.obligatoryDays = globalConfig.obligatoryDays;
                hasChanges = true;
            }

            if (hasChanges) {
                await YearlyVacationDays.findByIdAndUpdate(
                    userConfig._id,
                    {
                        electiveDaysTotalCount:
                            userConfig.electiveDaysTotalCount,
                        obligatoryDays: userConfig.obligatoryDays,
                    }
                );
            }
        }
    }

    return userConfig as unknown as YearlyVacationRow;
};
