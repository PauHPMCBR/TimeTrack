import { withApi } from '@/lib/api-handler';
import { Group } from '@/models';
import { UserIdParamSchema } from 'shared/src/schemas/api';

export default withApi(
    { method: 'GET', guard: 'selfOrAdmin', query: UserIdParamSchema },
    async (_req, res, { query }) => {
        const groups = await Group.find({
            members: query.userId,
        })
            .sort({ name: 1 })
            .lean();

        res.status(200).json({ success: true, data: { groups } });
    }
);
