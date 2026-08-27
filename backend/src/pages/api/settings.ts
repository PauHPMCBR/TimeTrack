import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { authenticateToken, AuthRequest } from '@/lib/auth';
import { getAppSettings } from '@/lib/settings';
import {
    responseErrorGet,
    responseErrorMethodNotAllowed,
} from '@/lib/response-error-generator';

// Read-only company settings for any authenticated user (e.g. non-working days
// for the calendar). Same data as /api/admin/settings but not admin-gated.
async function handler(req: AuthRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return responseErrorMethodNotAllowed(res);
    }

    try {
        await dbConnect();
        const settings = await getAppSettings();
        res.status(200).json({
            success: true,
            data: { settings },
        });
    } catch (error) {
        console.error('Get settings error:', error);
        return responseErrorGet(res);
    }
}

export default authenticateToken(handler);
