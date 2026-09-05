import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { AuthRequest, requireRole } from '@/lib/auth';
import { ADMIN_ROLE } from 'shared/src/lib/constants';
import { User } from '@/models';
import { UserRow } from '@/lib/rows';
import { toPublicUser } from '@/lib/sanitize';
import {
    responseErrorGet,
    responseErrorMethodNotAllowed,
} from '@/lib/response-error-generator';

// Admin list of soft-deleted users (edit to resolve conflicts, or restore).
async function handler(req: AuthRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return responseErrorMethodNotAllowed(res);
    }

    try {
        await dbConnect();

        const users = (await User.find({ deleted: true })
            .sort({ deletedAt: -1 })
            .lean()) as unknown as UserRow[];

        res.status(200).json({
            success: true,
            data: {
                users: users.map((u) => ({
                    ...toPublicUser(u),
                    _id: u._id.toString(),
                    // toPublicUser strips `deleted`; restore it for the client.
                    deleted: true,
                    deletedAt: u.deletedAt
                        ? u.deletedAt.toISOString()
                        : new Date(0).toISOString(),
                })),
            },
        });
    } catch (error) {
        console.error('Admin get deleted users error:', error);
        return responseErrorGet(res);
    }
}

export default requireRole([ADMIN_ROLE], handler);
