import { withApi } from '@/lib/api-handler';
import { MonthlyApproval } from '@/models';
import {
    responseErrorEntryNotFound,
    responseErrorIllegalAction,
    responseErrorPost,
} from '@/lib/response-error-generator';
import { APPROVAL_APPROVED } from 'shared/src/lib/constants';
import { sameId } from '@/lib/objectid';

// The worker confirms their monthly record. Owner-only on purpose: nobody can
// confirm a month on behalf of a worker (the confirmation is the worker's
// signature on the record, per the registro de jornada requirements).
export default withApi({ method: 'POST' }, async (req, res) => {
    try {
        const approvalId = req.query.approvalId as string;

        const approval = await MonthlyApproval.findById(approvalId);
        if (!approval) {
            return responseErrorEntryNotFound(res, 'MonthlyApproval');
        }

        if (!sameId(approval.userId, req.user!.userId)) {
            return responseErrorIllegalAction(res, 'ModifyingFromAnotherUser');
        }

        if (approval.status === APPROVAL_APPROVED) {
            return responseErrorIllegalAction(res, 'MonthAlreadyApproved');
        }

        approval.status = APPROVAL_APPROVED;
        approval.approvedAt = new Date();
        await approval.save();

        res.status(200).json({
            success: true,
            data: { approval },
        });
    } catch (error) {
        console.error('Approve monthly record error:', error);
        return responseErrorPost(res);
    }
});
