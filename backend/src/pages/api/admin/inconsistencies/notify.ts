import type { NextApiResponse } from 'next';
import type { NextApiRequest } from 'next';
import { responseError, responseErrorMethodNotAllowed, responseErrorPost } from '@/lib/response-error-generator';
import { runDailyInconsistencyReminder } from '@/lib/reminders';

// Manual / cron trigger for the daily inconsistency reminder. Protected by the
// CRON_SECRET env var (sent in the x-cron-secret header) since there is no
// authenticated user on a cron call. Also useful for testing.
async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return responseErrorMethodNotAllowed(res);
    }

    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers['x-cron-secret'] !== secret) {
        return responseError(res, 403, 'InsufficientPermissions');
    }

    try {
        const q = req.query?.date;
        const date =
            typeof q === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : undefined;
        const summary = await runDailyInconsistencyReminder(date);
        res.status(200).json({ success: true, data: summary });
    } catch (error) {
        console.error('Daily inconsistency reminder error:', error);
        return responseErrorPost(res);
    }
}

export default handler;