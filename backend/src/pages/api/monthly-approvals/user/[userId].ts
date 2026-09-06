import { withApi } from '@/lib/api-handler';
import { MonthlyApproval } from '@/models';
import { MonthlyApprovalRow } from 'shared/src/schemas/api';

// The worker's monthly record confirmations: months opened for approval
// (pending) and months they already confirmed (approved).
export default withApi(
    { method: 'GET', guard: 'sameGroupOrAdmin' },
    async (req, res) => {
        const userId = req.query.userId as string;

        const approvals = (await MonthlyApproval.find({ userId })
            .sort({ year: -1, month: -1 })
            .lean()) as unknown as MonthlyApprovalRow[];

        res.status(200).json({
            success: true,
            data: { approvals },
        });
    }
);
