import { withApi } from '@/lib/api-handler';
import { ADMIN_ROLE } from 'shared/src/lib/constants';
import { Group, User } from '@/models';
import { toPublicUser } from '@/lib/sanitize';
import { findActiveByEmail } from '@/repositories/user-repository';
import {
    responseErrorEntryNotFound,
    responseErrorIncorrectParameter,
    responseErrorPost,
} from '@/lib/response-error-generator';
import { UserIdParamSchema } from 'shared/src/schemas/api';

// Restores a soft-deleted user: clears the flag and re-adds them to their groups.
export default withApi(
    {
        method: 'POST',
        guard: 'admin',
        query: UserIdParamSchema,
        audit: {
            action: 'user_restored',
            targetType: 'user',
            targetId: (_req, ctx) => (ctx.query as { userId: string }).userId,
        },
    },
    async (req, res, { query }) => {
    try {
        const userId = query.userId;

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
        const emailConflict = await findActiveByEmail(
            user.email.toLowerCase(),
            { excludeId: user._id }
        );
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
);
