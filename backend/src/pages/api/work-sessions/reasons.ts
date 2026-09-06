import { withApi } from '@/lib/api-handler';
import { WorkSessionReason } from '@/models';

export default withApi({ method: 'GET' }, async (_req, res) => {
    const reasons = await WorkSessionReason.find().lean();

    res.status(200).json({ success: true, data: { reasons } });
});
