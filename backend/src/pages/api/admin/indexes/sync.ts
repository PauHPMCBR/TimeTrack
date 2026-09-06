import type { NextApiResponse } from 'next';
import type { NextApiRequest } from 'next';
import dbConnect from '@/lib/mongodb';
import { AuthRequest, requireRole } from '@/lib/auth';
import { ADMIN_ROLE } from 'shared/src/lib/constants';
import {
    User,
    WorkSession,
    ElectiveVacation,
    Group,
    YearlyVacationDays,
    WorkSessionReason,
    MonthlyApproval,
    UserFile,
} from '@/models';
import {
    responseErrorPost,
    responseErrorMethodNotAllowed,
} from '@/lib/response-error-generator';

// One-time / on-demand op: create (or update) the Mongo indexes declared in the
// model definitions. Mongoose disables autoIndex in production (NODE_ENV=production),
// so new/changed indexes must be applied explicitly. Run once after deploying:
//
//   curl -X POST -H "Authorization: Bearer <admin-token>" \
//     http://localhost:3001/api/admin/indexes/sync
//
// scripts/deploy-all.js also calls this automatically after recreating each
// company's stack, using the company's CRON_SECRET env (x-cron-secret header),
// since it has no admin credentials.
async function handler(req: AuthRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return responseErrorMethodNotAllowed(res);
    }

    try {
        await dbConnect();

        const results: Record<string, unknown> = {};
        for (const [name, model] of Object.entries({
            User,
            WorkSession,
            ElectiveVacation,
            Group,
            YearlyVacationDays,
            WorkSessionReason,
            MonthlyApproval,
            UserFile,
        })) {
            results[name] = await model.syncIndexes();
        }

        res.status(200).json({ success: true, data: { indexes: results } });
    } catch (error) {
        console.error('Sync indexes error:', error);
        return responseErrorPost(res);
    }
}

// Admin token OR the CRON_SECRET env (x-cron-secret header), mirroring the
// cron-trigger pattern of /api/admin/inconsistencies/notify.
export default function (req: NextApiRequest, res: NextApiResponse) {
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers['x-cron-secret'] === secret) {
        return handler(req as AuthRequest, res);
    }
    return requireRole([ADMIN_ROLE], handler)(req as AuthRequest, res);
}
