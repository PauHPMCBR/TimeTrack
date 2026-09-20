import { ElectiveVacation } from '@/models';
import {
    ensureUserYearConfig,
    findOverlapping,
} from '@/repositories/vacation-repository';
import {
    responseErrorIllegalAction,
    responseErrorPost,
} from '@/lib/response-error-generator';
import { ElectiveVacationRequestSchema } from 'shared/src/schemas/api';
import { withApi } from '@/lib/api-handler';
import {
    VACATION_APPROVED,
    VACATION_PENDING,
} from 'shared/src/lib/constants';
import { getAppSettings } from '@/lib/settings';
import {
    countSpentVacationDays,
    nonWorkingDaysOfWeek,
    resolveNonWorkingDays,
} from 'shared/src/lib/vacation-days';
import type { ElectiveVacationRow } from '@/lib/rows';

export default withApi(
    { method: 'POST', body: ElectiveVacationRequestSchema },
    async (req, res, { body }) => {
    try {
        const { startDate, endDate, reason } = body;
        const userId = req.user!.userId;
        const year = Number(startDate.slice(0, 4));

        if (endDate.slice(0, 4) !== String(year)) {
            return responseErrorIllegalAction(res, 'VacationCrossYear');
        }

        const yearlyVacationDays = await ensureUserYearConfig(userId, year);
        if (!yearlyVacationDays) {
            return responseErrorIllegalAction(res, 'NoVacationConfig');
        }

        // Overlap check: one interval per user (pending/approved), so the same
        // day can never be discounted twice.
        const overlapping = await findOverlapping(startDate, endDate, {
            userId,
            statuses: [VACATION_PENDING, VACATION_APPROVED],
        });

        if (overlapping.length > 0) {
            return responseErrorIllegalAction(res, 'VacationOverlap');
        }

        // The backend computes the cost of the request itself: calendar days
        // minus the user's non-working days and the company obligatory days.
        const settings = await getAppSettings();
        const nonWorkingDays = resolveNonWorkingDays(
            req.dbUser,
            nonWorkingDaysOfWeek(settings.defaultWeeklyExpectedHours)
        );
        const spentDays = countSpentVacationDays(
            startDate,
            endDate,
            nonWorkingDays,
            yearlyVacationDays.obligatoryDays
        );

        // A period made up only of non-working and obligatory days costs
        // nothing and would just clutter the request list.
        if (spentDays === 0) {
            return responseErrorIllegalAction(res, 'VacationZeroDays');
        }

        // Balance: spent days of every live request this year (pending ones
        // included — they may still be approved).
        const yearRequests: Pick<ElectiveVacationRow, 'spentDays'>[] =
            await ElectiveVacation.find({
                userId,
                status: { $in: [VACATION_PENDING, VACATION_APPROVED] },
                startDate: {
                    $gte: `${year}-01-01`,
                    $lte: `${year}-12-31`,
                },
            });
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
            startDate,
            endDate,
            spentDays,
            reason,
        });

        res.status(201).json({ success: true, data: { vacation: elective } });
    } catch (error) {
        console.error('Create elective vacation error:', error);
        return responseErrorPost(res);
    }
    }
);
