import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { AuthRequest, requireRole } from '@/lib/auth';
import { ADMIN_ROLE, APPROVAL_PENDING } from 'shared/src/lib/constants';
import { MonthlyApproval, User } from '@/models';
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

interface SkippedEntry {
    userId: string;
    userName?: string;
}

// Opens a past month for the workers' confirmation. By default (force=false)
// a user whose month still has anomalies (same criteria as the admin report)
// is refused and reported back as "blocked"; with force=true those users are
// opened anyway. Users whose tracking had not started by that month are
// excluded ("notTracking"). Users who already have a pending request for the
// month are not re-emailed ("skipped") to avoid duplicate notifications.
// The result distinguishes users actually notified (request email sent just
// now) from those opened but whose email could not be sent ("emailFailed" —
// revoke + re-open to retry notifying them).
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
        const { year, month, userIds, force = false } =
            req.body as MonthlyApprovalOpenRequest;

        if (!isPastMonth(year, month, new Date())) {
            return responseErrorIllegalAction(res, 'MonthNotPast');
        }

        const targetUsers = (userIds
            ? await User.find(
                  {
                      _id: { $in: userIds },
                      blocked: { $ne: true },
                      deleted: { $ne: true },
                  },
                  'name trackingStartDate checkInRequired'
              ).lean()
            : await User.find(
                  {
                      registered: true,
                      blocked: { $ne: true },
                      deleted: { $ne: true },
                      checkInRequired: { $ne: false },
                  },
                  'name trackingStartDate'
              ).lean()) as unknown as {
            _id: string;
            name: string;
            trackingStartDate?: Date | null;
            checkInRequired?: boolean;
        }[];

        const now = new Date();
        const notified: MonthlyApprovalRow[] = [];
        const emailFailed: SkippedEntry[] = [];
        const blocked: BlockedEntry[] = [];
        const skipped: SkippedEntry[] = [];

        // Users whose tracking started after this month are excluded (they
        // were not doing tracking at all during the target month).
        const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
        const notTrackingIds = new Set<string>();
        const notTracking: SkippedEntry[] = [];
        for (const u of targetUsers) {
            if (u.checkInRequired === false || (u.trackingStartDate && new Date(u.trackingStartDate) > monthEnd)) {
                notTrackingIds.add(u._id.toString());
                notTracking.push({ userId: u._id.toString(), userName: u.name });
            }
        }

        // Pending requests that already exist for this month: skip re-emailing.
        const existingPending = (await MonthlyApproval.find({
            year,
            month,
            status: APPROVAL_PENDING,
            userId: { $in: targetUsers.map((u) => u._id.toString()) },
        }).lean()) as unknown as { userId: string }[];
        const existingPendingIds = new Set(
            existingPending.map((e) => e.userId.toString())
        );

        for (const user of targetUsers) {
            const id = user._id.toString();

            if (notTrackingIds.has(id)) continue;

            if (existingPendingIds.has(id)) {
                // Already pending and already notified; keep the record intact
                // (don't reset requestedAt or re-email) so we don't spam or
                // delay reminders. (Approved months aren't pending and are
                // handled by the normal open path.)
                skipped.push({ userId: id, userName: user.name });
                continue;
            }

            const anomalies = force
                ? []
                : await computeMonthAnomalies(id, year, month);
            if (anomalies.length > 0) {
                blocked.push({
                    userId: id,
                    userName: user.name,
                    anomalies,
                });
                continue;
            }

            const { doc, emailSent } = (await openMonthForUser(
                id,
                { year, month },
                now
            )) as { doc: MonthlyApprovalRow; emailSent: boolean };
            const row = {
                ...doc,
                _id: doc._id.toString(),
                userName: user.name,
            };
            if (emailSent) {
                notified.push(row);
            } else {
                emailFailed.push({ userId: id, userName: user.name });
            }
        }

        res.status(200).json({
            success: true,
            data: { notified, emailFailed, blocked, skipped, notTracking },
        });
    } catch (error) {
        console.error('Open monthly approvals error:', error);
        return responseErrorPost(res);
    }
}

export default requireRole([ADMIN_ROLE], handler);
