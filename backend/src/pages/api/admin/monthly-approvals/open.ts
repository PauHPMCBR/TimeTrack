import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { AuthRequest, requireRole } from '@/lib/auth';
import { ADMIN_ROLE } from 'shared/src/lib/constants';
import { User } from '@/models';
import {
    responseErrorIllegalAction,
    responseErrorMethodNotAllowed,
    responseErrorPost,
} from '@/lib/response-error-generator';
import { runValidation, validateRequestBody } from '@/lib/validation';
import {
    MonthlyApprovalOpenRequest,
    MonthlyApprovalOpenRequestSchema,
    MonthlyApprovalRow,
    WorkSessionAnomaly,
} from 'shared/src/schemas/api';
import {
    computeMonthAnomalies,
    isPastMonth,
    openMonthForUser,
} from '@/lib/monthly-approvals';

interface BlockedEntry {
    userId: string;
    userName?: string;
    anomalies: WorkSessionAnomaly[];
}

// Opens a past month for the workers' confirmation (sends each worker an
// approval-request mail). Hard gate: a user whose month still has anomalies
// (same criteria as the admin report) is refused and reported back as
// "blocked" so admins can fix the record first.
async function handler(req: AuthRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return responseErrorMethodNotAllowed(res);
    }

    if (
        !(await runValidation(
            validateRequestBody(MonthlyApprovalOpenRequestSchema),
            req,
            res
        ))
    )
        return;

    try {
        await dbConnect();
        const { year, month, userIds } =
            req.body as MonthlyApprovalOpenRequest;

        if (!isPastMonth(year, month, new Date())) {
            return responseErrorIllegalAction(res, 'MonthNotPast');
        }

        const targetUsers = (userIds
            ? await User.find({ _id: { $in: userIds } }, 'name').lean()
            : await User.find(
                  { role: { $ne: ADMIN_ROLE }, registered: true },
                  'name'
              ).lean()) as unknown as { _id: string; name: string }[];

        const now = new Date();
        const opened: MonthlyApprovalRow[] = [];
        const blocked: BlockedEntry[] = [];

        for (const user of targetUsers) {
            const anomalies = await computeMonthAnomalies(
                user._id.toString(),
                year,
                month
            );
            if (anomalies.length > 0) {
                blocked.push({
                    userId: user._id.toString(),
                    userName: user.name,
                    anomalies,
                });
                continue;
            }

            const doc = (await openMonthForUser(
                user._id.toString(),
                { year, month },
                now
            )) as MonthlyApprovalRow;
            opened.push({
                ...doc,
                _id: doc._id.toString(),
                userName: user.name,
            });
        }

        res.status(200).json({
            success: true,
            data: { opened, blocked },
        });
    } catch (error) {
        console.error('Open monthly approvals error:', error);
        return responseErrorPost(res);
    }
}

export default requireRole([ADMIN_ROLE], handler);
