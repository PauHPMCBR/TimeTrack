import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { AuthRequest, requireSameGroupOrAdmin } from '@/lib/auth';
import { ElectiveVacation, YearlyVacationDays } from '@/models';
import {
    responseErrorGet,
    responseErrorMethodNotAllowed,
} from '@/lib/response-error-generator';
import { runValidation, validateQueryParams } from '@/lib/validation';
import { ElectiveVacationRow, YearlyVacationRow } from '@/lib/rows';
import { resolveVacationNames } from '@/lib/vacation-names';
import {
    UserYearParamSchema,
    YearlyVacationResponse,
} from 'shared/src/schemas/api';

async function handler(req: AuthRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return responseErrorMethodNotAllowed(res);
    }

    if (
        !(await runValidation(
            validateQueryParams(UserYearParamSchema),
            req,
            res
        ))
    )
        return;

    try {
        await dbConnect();
        const userId = req.query.userId as string;
        const year = parseInt(req.query.year as string);
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 11, 31, 23, 59, 59, 999);

        const [vacations, globalSettings, yearlyVacationDaysResult] =
            (await Promise.all([
                ElectiveVacation.find({
                    userId: userId,
                    // Intervals overlapping the requested year.
                    startDate: { $lte: endDate },
                    endDate: { $gte: startDate },
                })
                    .sort({ startDate: 1 })
                    .lean(),
                YearlyVacationDays.findOne({
                    year: year,
                    userId: { $exists: false }, // global template (no userId)
                }).lean(),
                YearlyVacationDays.findOne({
                    year: year,
                    userId: userId,
                }).lean(),
            ])) as unknown as [
                ElectiveVacationRow[],
                YearlyVacationRow | null,
                YearlyVacationRow | null,
            ];

        let yearlyVacationDays = yearlyVacationDaysResult;

        if (!yearlyVacationDays) {
            if (globalSettings) {
                yearlyVacationDays = (await YearlyVacationDays.create({
                    userId: userId,
                    year: year,
                    obligatoryDays: globalSettings.obligatoryDays,
                    electiveDaysTotalCount:
                        globalSettings.electiveDaysTotalCount,
                })) as unknown as YearlyVacationRow;
            }
        } else {
            if (globalSettings) {
                let hasChanges = false;

                if (
                    yearlyVacationDays.electiveDaysTotalCount !==
                    globalSettings.electiveDaysTotalCount
                ) {
                    yearlyVacationDays.electiveDaysTotalCount =
                        globalSettings.electiveDaysTotalCount;
                    hasChanges = true;
                }

                if (
                    JSON.stringify(yearlyVacationDays.obligatoryDays) !==
                    JSON.stringify(globalSettings.obligatoryDays)
                ) {
                    yearlyVacationDays.obligatoryDays =
                        globalSettings.obligatoryDays;
                    hasChanges = true;
                }

                if (hasChanges) {
                    await YearlyVacationDays.findByIdAndUpdate(
                        yearlyVacationDays._id,
                        {
                            electiveDaysTotalCount:
                                yearlyVacationDays.electiveDaysTotalCount,
                            obligatoryDays: yearlyVacationDays.obligatoryDays,
                        }
                    );
                }
            }
        }

        const response: YearlyVacationResponse = {
            year: year,
            electives: (await resolveVacationNames(
                vacations
            )) as YearlyVacationResponse['electives'],
            yearlyVacationDays: yearlyVacationDays,
        };

        res.status(200).json({ success: true, data: response });
    } catch (error) {
        console.error('Get vacations error:', error);
        return responseErrorGet(res);
    }
}

export default requireSameGroupOrAdmin(handler);
