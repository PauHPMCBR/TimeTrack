import type { NextApiRequest, NextApiResponse } from 'next';
import { withApi } from '@/lib/api-handler';
import { responseErrorPost } from '@/lib/response-error-generator';
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

// One-time / on-demand op: create (or update) the Mongo indexes declared in the
// model definitions. Mongoose disables autoIndex in production (NODE_ENV=production),
// so new/changed indexes must be applied explicitly. Run once after deploying:
//
//   curl -X POST --cookie "auth_token=<admin-token>" \
//     http://localhost:3001/api/admin/indexes/sync
//
// scripts/deploy-all.js also calls this automatically after recreating each
// company's stack, using the company's CRON_SECRET env (x-cron-secret header),
// since it has no admin credentials.
const syncHandler = async (
    req: NextApiRequest,
    res: NextApiResponse
): Promise<unknown> => {
    try {
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
};

const adminHandler = withApi(
    { method: 'POST', guard: 'admin' },
    syncHandler as never
);
const cronHandler = withApi(
    { method: 'POST', guard: 'none' },
    syncHandler as never
);

// Admin token OR the CRON_SECRET env (x-cron-secret header), mirroring the
// cron-trigger pattern of /api/admin/inconsistencies/notify.
export default function (req: NextApiRequest, res: NextApiResponse) {
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers['x-cron-secret'] === secret) {
        return cronHandler(req, res);
    }
    return adminHandler(req, res);
}
