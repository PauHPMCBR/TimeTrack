import { withApi } from '@/lib/api-handler';
import { Group } from '@/models';

export default withApi(
    { method: 'GET', guard: 'admin' },
    async (_req, res) => {
        const groups = await Group.find({}).lean();

        res.status(200).json({
            success: true,
            data: { groups },
        });
    }
);
