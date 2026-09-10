import { withApi } from '@/lib/api-handler';
import { MonthlyApproval, MonthlyApprovalEvent } from '@/models';
import { responseErrorEntryNotFound } from '@/lib/response-error-generator';
import { APPROVAL_EVENT_REVOKED } from 'shared/src/lib/constants';
import { MonthlyApprovalRevokeRequestSchema } from 'shared/src/schemas/api';

// Revokes a monthly record confirmation (pending or approved), unlocking the
// month for edits. After editing, the admin must open the month again, which
// starts a new approval cycle for the worker. The live document is deleted,
// but an append-only 'revoked' event (with the acting admin) preserves the
// evidentiary chain of the confirmation cycle.
export default withApi(
    {
        method: 'POST',
        guard: 'admin',
        body: MonthlyApprovalRevokeRequestSchema,
    },
    async (req, res, { body }) => {
        const { userId, year, month } = body;

        const approval = await MonthlyApproval.findOne({ userId, year, month });
        if (!approval) {
            return responseErrorEntryNotFound(res, 'MonthlyApproval');
        }

        await MonthlyApprovalEvent.create({
            userId,
            year,
            month,
            action: APPROVAL_EVENT_REVOKED,
            actorId: req.user!.userId,
            timestamp: new Date(),
        });
        await MonthlyApproval.deleteOne({ _id: approval._id });

        res.status(200).json({ success: true });
    }
);
