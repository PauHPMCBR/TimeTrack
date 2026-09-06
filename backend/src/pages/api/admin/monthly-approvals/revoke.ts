import { withApi } from '@/lib/api-handler';
import { MonthlyApproval } from '@/models';
import { responseErrorEntryNotFound } from '@/lib/response-error-generator';
import {
    MonthlyApprovalRevokeRequestSchema,
} from 'shared/src/schemas/api';

// Revokes a monthly record confirmation (pending or approved), unlocking the
// month for edits. After editing, the admin must open the month again, which
// starts a new approval cycle for the worker.
export default withApi(
    {
        method: 'POST',
        guard: 'admin',
        body: MonthlyApprovalRevokeRequestSchema,
    },
    async (_req, res, { body }) => {
        const { userId, year, month } = body;

        const result = await MonthlyApproval.deleteOne({ userId, year, month });
        if (result.deletedCount === 0) {
            return responseErrorEntryNotFound(res, 'MonthlyApproval');
        }

        res.status(200).json({ success: true });
    }
);
