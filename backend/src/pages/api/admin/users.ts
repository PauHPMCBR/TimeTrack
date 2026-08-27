import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { AuthRequest, requireRole } from '@/lib/auth';
import { ADMIN_ROLE } from 'shared/src/lib/constants';
import { User } from '@/models';
import { toPublicUser } from '@/lib/sanitize';
import {
    responseErrorGet,
    responseErrorMethodNotAllowed,
} from '@/lib/response-error-generator';

async function handler(req: AuthRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return responseErrorMethodNotAllowed(res);
    }

    try {
        await dbConnect();

        const users = await User.find({}).lean();
        // toPublicUser strips the password hash, registration tokens and lockout
        // state (failedLoginAttempts/blocked/blockedSince) before sending.
        res.status(200).json({
            success: true,
            data: {
                users: users.map((u) => toPublicUser(u)),
            },
        });
    } catch (error) {
        console.error('Admin get users error:', error);
        return responseErrorGet(res);
    }
}

export default requireRole([ADMIN_ROLE], handler);
