import { withApi } from '@/lib/api-handler';
import { User } from '@/models';
import { responseErrorEntryNotFound } from '@/lib/response-error-generator';
import { UserIdParamSchema } from 'shared/src/schemas/api';
import { toPublicUser } from '@/lib/sanitize';
import { notDeleted } from '@/repositories/user-repository';
import type { UserRow } from '@/lib/rows';

export default withApi(
    { method: 'GET', guard: 'sameGroupOrAdmin', query: UserIdParamSchema },
    async (_req, res, { query }) => {
        const userDoc = await User.findOne({
            _id: query.userId,
            ...notDeleted,
        })
            .populate('groups', 'name description')
            .lean<UserRow>();

        if (!userDoc) {
            return responseErrorEntryNotFound(res, 'User');
        }

        res.status(200).json({
            success: true,
            data: {
                user: toPublicUser(userDoc),
            },
        });
    }
);
