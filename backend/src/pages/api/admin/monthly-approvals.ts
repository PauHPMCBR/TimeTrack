import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { AuthRequest, requireRole } from '@/lib/auth';
import { ADMIN_ROLE, APPROVAL_PENDING } from 'shared/src/lib/constants';
import { MonthlyApproval, User } from '@/models';
import {
    responseErrorGet,
    responseErrorMethodNotAllowed,
} from '@/lib/response-error-generator';
import { MonthlyApprovalRow } from 'shared/src/schemas/api';

// Registry of monthly record confirmations: which months are pending worker
// approval and which are already confirmed. Pending rows come first (oldest
// request first) so admins can chase stragglers.
async function handler(req: AuthRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return responseErrorMethodNotAllowed(res);
    }

    try {
        await dbConnect();

        const approvals = (await MonthlyApproval.find({})
            .lean()) as unknown as (MonthlyApprovalRow & {
            userId: string;
        })[];

        const userIds = Array.from(new Set(approvals.map((a) => a.userId)));
        const users = userIds.length
            ? ((await User.find(
                  {
                      _id: { $in: userIds },
                      blocked: { $ne: true },
                      registered: true,
                  },
                  'name'
              ).lean()) as unknown as { _id: string; name: string }[])
            : [];
        const nameById = new Map(users.map((u) => [u._id.toString(), u.name]));

        const rows: MonthlyApprovalRow[] = approvals
            .filter((a) => nameById.has(a.userId.toString()))
            .map((a) => ({
                ...a,
                _id: a._id.toString(),
                userName: nameById.get(a.userId.toString()),
            }))
            .sort((a, b) => {
                const pendingDelta =
                    (a.status === APPROVAL_PENDING ? 0 : 1) -
                    (b.status === APPROVAL_PENDING ? 0 : 1);
                return (
                    pendingDelta ||
                    b.year - a.year ||
                    b.month - a.month ||
                    a.userName?.localeCompare(b.userName ?? '') ||
                    0
                );
            });

        res.status(200).json({
            success: true,
            data: { approvals: rows },
        });
    } catch (error) {
        console.error('Admin monthly approvals error:', error);
        return responseErrorGet(res);
    }
}

export default requireRole([ADMIN_ROLE], handler);
