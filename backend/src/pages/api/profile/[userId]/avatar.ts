import { withApi } from '@/lib/api-handler';
import { User } from '@/models';
import { responseErrorEntryNotFound } from '@/lib/response-error-generator';
import { UserIdParamSchema } from 'shared/src/schemas/api';
import { AVATAR_MIME, readAvatar } from '@/lib/storage';
import { notDeleted } from '@/repositories/user-repository';

export default withApi(
    { method: 'GET', guard: 'sameGroupOrAdmin', query: UserIdParamSchema },
    async (_req, res, { query }) => {
        const user = await User.findOne({
            _id: query.userId,
            ...notDeleted,
        }).select('avatar');

        if (!user || !user.avatar) {
            return responseErrorEntryNotFound(res, 'Avatar');
        }

        let data: Buffer;
        try {
            data = await readAvatar(user.avatar);
        } catch {
            return responseErrorEntryNotFound(res, 'Avatar');
        }

        res.setHeader('Content-Type', AVATAR_MIME);
        res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
        res.status(200).send(data);
    }
);
