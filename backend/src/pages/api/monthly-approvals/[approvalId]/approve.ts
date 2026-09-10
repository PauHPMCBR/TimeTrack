import { withApi } from '@/lib/api-handler';
import { MonthlyApproval, MonthlyApprovalEvent } from '@/models';
import {
    responseErrorEntryNotFound,
    responseErrorIllegalAction,
    responseErrorPost,
} from '@/lib/response-error-generator';
import {
    APPROVAL_APPROVED,
    APPROVAL_EVENT_CONFIRMED,
} from 'shared/src/lib/constants';
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

        const now = new Date();
        approval.status = APPROVAL_APPROVED;
        approval.approvedAt = now;
        await approval.save();

        // Append-only history: the confirmation is the worker's signature on
        // the record, so the actor (always the worker themself) and the
        // moment are kept even after a later revoke deletes the doc.
        await MonthlyApprovalEvent.create({
            userId: approval.userId,
            year: approval.year,
            month: approval.month,
            action: APPROVAL_EVENT_CONFIRMED,
            actorId: req.user!.userId,
            timestamp: now,
        });

        res.status(200).json({
            success: true,
            data: { approval },
        });
    } catch (error) {
        console.error('Approve monthly record error:', error);
        return responseErrorPost(res);
    }
});
