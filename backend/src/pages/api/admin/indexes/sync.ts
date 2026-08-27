import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { AuthRequest, requireRole } from '@/lib/auth';
import {
    User,
    WorkSession,
    ElectiveVacation,
    Group,
    YearlyVacationDays,
    WorkSessionReason,
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
        })) {
            results[name] = await (model as any).syncIndexes();
        }

        res.status(200).json({ success: true, data: { indexes: results } });
    } catch (error) {
        console.error('Sync indexes error:', error);
        return responseErrorPost(res);
    }
}

export default requireRole(['admin'], handler);
