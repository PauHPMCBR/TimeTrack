import { withApi } from '@/lib/api-handler';
import { ElectiveVacation } from '@/models';
import {
    responseErrorIllegalAction,
    responseErrorPost,
} from '@/lib/response-error-generator';
import { VACATION_CANCELLED } from 'shared/src/lib/constants';
import { sameId } from '@/lib/objectid';

export default withApi({ method: 'POST' }, async (req, res) => {
    try {
        const vacationId = req.query.vacationId as string;
        const userId = req.user!.userId;

        const vacation = await ElectiveVacation.findById(vacationId);

        if (!vacation) {
            return responseErrorIllegalAction(res, 'ModifyingFromAnotherUser');
        }

        if (!sameId(vacation.userId, userId)) {
            return responseErrorIllegalAction(res, 'ModifyingFromAnotherUser');
        }

        await ElectiveVacation.findByIdAndUpdate(vacationId, {
            status: VACATION_CANCELLED,
            updatedAt: new Date(),
        });

        res.status(201).json({ success: true });
    } catch (error) {
        console.error('Cancel elective vacation error:', error);
        return responseErrorPost(res);
    }
});
