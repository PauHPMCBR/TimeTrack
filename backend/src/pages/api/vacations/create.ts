import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { AuthRequest, authenticateToken } from '@/lib/auth';
import { ElectiveVacation, YearlyVacationDays } from '@/models';
import {
    responseErrorIllegalAction,
    responseErrorMethodNotAllowed,
    responseErrorPost,
} from '@/lib/response-error-generator';
import { runValidation, validateRequestBody } from '@/lib/validation';
import { ElectiveVacationRequestSchema } from 'shared/src/schemas/api';
import {
    VACATION_APPROVED,
    VACATION_PENDING,
} from 'shared/src/lib/constants';
import { getAppSettings, getConfiguredTimezone } from '@/lib/settings';
import {
    countSpentVacationDays,
    resolveNonWorkingDays,
} from 'shared/src/lib/vacation-days';

async function handler(req: AuthRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return responseErrorMethodNotAllowed(res);
    }

    if (
        !(await runValidation(
            validateRequestBody(ElectiveVacationRequestSchema),
            req,
            res
        ))
    )
        return;

    try {
        await dbConnect();
        const { startDate, endDate, reason } = req.body;
        const userId = req.user!.userId;
        // Both bounds arrive at local midnight (see ElectiveVacationRequestSchema).
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(0, 0, 0, 0);
        const year = start.getFullYear();

        if (end.getFullYear() !== year) {
            return responseErrorIllegalAction(res, 'VacationCrossYear');
        }

        let yearlyVacationDays = await YearlyVacationDays.findOne({
            year,
            userId,
        });

        if (!yearlyVacationDays) {
            const globalConfig = await YearlyVacationDays.findOne({
                year,
                userId: { $exists: false },
            });

            if (!globalConfig) {
                return responseErrorIllegalAction(res, 'NoVacationConfig');
            }

            yearlyVacationDays = await YearlyVacationDays.create({
                userId,
                year: globalConfig.year,
                obligatoryDays: globalConfig.obligatoryDays,
                electiveDaysTotalCount: globalConfig.electiveDaysTotalCount,
            });
        }

        // Overlap check: one interval per user (pending/approved), so the same
        // day can never be discounted twice.
        const overlapping = await ElectiveVacation.findOne({
            userId,
            status: { $in: [VACATION_PENDING, VACATION_APPROVED] },
            startDate: { $lte: end },
            endDate: { $gte: start },
        });

        if (overlapping) {
            return responseErrorIllegalAction(res, 'VacationOverlap');
        }

        // The backend computes the cost of the request itself: calendar days
        // minus the user's non-working days and the company obligatory days.
        const settings = await getAppSettings();
        const nonWorkingDays = resolveNonWorkingDays(
            req.dbUser,
            settings.nonWorkingDays
        );
        const spentDays = countSpentVacationDays(
            start,
            end,
            nonWorkingDays,
            yearlyVacationDays.obligatoryDays,
            getConfiguredTimezone()
        );

        // A period made up only of non-working and obligatory days costs
        // nothing and would just clutter the request list.
        if (spentDays === 0) {
            return responseErrorIllegalAction(res, 'VacationZeroDays');
        }

        // Balance: spent days of every live request this year (pending ones
        // included — they may still be approved).
        const yearStart = new Date(year, 0, 1);
        const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
        const yearRequests = (await ElectiveVacation.find({
            userId,
            status: { $in: [VACATION_PENDING, VACATION_APPROVED] },
            startDate: { $gte: yearStart, $lte: yearEnd },
        })) as unknown as Array<{ spentDays: number }>;
        const usedDays = yearRequests.reduce(
            (sum, request) => sum + (request.spentDays ?? 0),
            0
        );

        if (
            usedDays + spentDays >
            yearlyVacationDays.electiveDaysTotalCount
        ) {
            return responseErrorIllegalAction(res, 'AllVacationsUsed');
        }

        const elective = await ElectiveVacation.create({
            userId,
            startDate: start,
            endDate: end,
            spentDays,
            reason,
        });

        res.status(201).json({ success: true, data: { vacation: elective } });
    } catch (error) {
        console.error('Create elective vacation error:', error);
        return responseErrorPost(res);
    }
}

export default authenticateToken(handler);
