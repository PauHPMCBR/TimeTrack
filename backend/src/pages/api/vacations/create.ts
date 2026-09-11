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
import { yearRange } from 'shared/src/lib/date-ranges';
import {
    VACATION_APPROVED,
    VACATION_PENDING,
} from 'shared/src/lib/constants';
import { getAppSettings, getConfiguredTimezone } from '@/lib/settings';
import {
    countSpentVacationDays,
    nonWorkingDaysOfWeek,
    resolveNonWorkingDays,
} from 'shared/src/lib/vacation-days';

export default withApi(
    { method: 'POST', body: ElectiveVacationRequestSchema },
    async (req, res, { body }) => {
    try {
        const { startDate, endDate, reason } = body;
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

        const yearlyVacationDays = await ensureUserYearConfig(userId, year);
        if (!yearlyVacationDays) {
            return responseErrorIllegalAction(res, 'NoVacationConfig');
        }

        // Overlap check: one interval per user (pending/approved), so the same
        // day can never be discounted twice.
        const overlapping = await findOverlapping(start, end, {
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
        const { start: yearStart, end: yearEnd } = yearRange(year);
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
);
