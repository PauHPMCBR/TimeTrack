import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { requireRole, AuthRequest } from '@/lib/auth';
import { ADMIN_ROLE } from 'shared/src/lib/constants';
import { Group, User } from '@/models';
import { toPublicUser } from '@/lib/sanitize';
import {
    responseErrorEntryNotFound,
    responseErrorIncorrectParameter,
    responseErrorMethodNotAllowed,
    responseErrorPost,
} from '@/lib/response-error-generator';
import { UserIdParamSchema } from 'shared/src/schemas/api';
import { runValidation, validateQueryParams } from '@/lib/validation';

// Restores a soft-deleted user: clears the flag and re-adds them to their groups.
async function handler(req: AuthRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return responseErrorMethodNotAllowed(res);
    }

    if (
        !(await runValidation(validateQueryParams(UserIdParamSchema), req, res))
    )
        return;

    try {
        await dbConnect();
        const userId = req.query.userId as string;

        const user = await User.findById(userId);
        if (!user) {
            return responseErrorEntryNotFound(res, 'User');
        }
        if (!user.deleted) {
            return responseErrorIncorrectParameter(res, 'userId', [
                'NotDeleted',
            ]);
        }
        if (user.role === ADMIN_ROLE) {
            return responseErrorIncorrectParameter(res, 'userId', [
                'CannotDeleteAdmin',
            ]);
        }

        // Email must stay unique among non-deleted users.
        const emailConflict = await User.findOne({
            email: user.email.toLowerCase(),
            _id: { $ne: user._id },
            deleted: { $ne: true },
        });
        if (emailConflict) {
            return responseErrorIncorrectParameter(res, 'email', [
                'AlreadyExists',
            ]);
        }

        await User.updateOne(
            { _id: user._id },
            {
                $set: { deleted: false, updatedAt: new Date() },
                $unset: { deletedAt: 1 },
            }
        );

        const groupIds = (
            user.groups as { toString(): string }[] | undefined
        )
            ?.map((g) => g.toString()) ?? [];
        if (groupIds.length > 0) {
            await Group.updateMany(
                { _id: { $in: groupIds } },
                { $addToSet: { members: user._id } }
            );
        }

        const restored = await User.findById(userId);
        res.status(200).json({
            success: true,
            data: { user: toPublicUser(restored) },
        });
    } catch (error) {
        console.error('Restore user error:', error);
        return responseErrorPost(res);
    }
}

export default requireRole([ADMIN_ROLE], handler);
