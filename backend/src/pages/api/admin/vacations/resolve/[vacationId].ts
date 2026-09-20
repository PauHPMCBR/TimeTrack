import { withApi } from '@/lib/api-handler';
import {
    VACATION_APPROVED,
    VACATION_CANCELLED,
    VACATION_PENDING,
    VACATION_REJECTED,
} from 'shared/src/lib/constants';
import { ElectiveVacation } from '@/models';
import {
    responseErrorEntryNotFound,
    responseErrorIncorrectParameter,
    responseErrorPost,
} from '@/lib/response-error-generator';
import { recomputeWorkDayRecordsForRange } from '@/lib/work-day-records';
import type { ElectiveVacationRow } from '@/lib/rows';

export default withApi({ method: 'POST', guard: 'admin' }, async (req, res) => {
    try {
        const vacationId = req.query.vacationId as string;
        const { status } = req.body;

        if (
            ![VACATION_PENDING, VACATION_APPROVED, VACATION_REJECTED, VACATION_CANCELLED].includes(
                status
            )
        ) {
            return responseErrorIncorrectParameter(res, 'status');
        }

        const existing = await ElectiveVacation.findById(vacationId).lean<
            Pick<ElectiveVacationRow, 'userId' | 'startDate' | 'endDate'> | null
        >();
        if (!existing) {
            return responseErrorEntryNotFound(res, 'Vacation');
        }

        // The spent-days balance is derived from the requests themselves, so
        // resolving only flips the status.
        await ElectiveVacation.findByIdAndUpdate(vacationId, {
            status,
            ...(status === VACATION_APPROVED
                ? { approvedBy: req.user?.userId, approvedAt: new Date() }
                : {}),
        });

        await recomputeWorkDayRecordsForRange(
            existing.userId,
            existing.startDate,
            existing.endDate
        );

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Resolve vacation error:', error);
        return responseErrorPost(res);
    }
});
