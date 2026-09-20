import { withApi } from '@/lib/api-handler';
import { AuthorizedLeave } from '@/models';
import { AuthorizedLeaveRow } from '@/lib/rows';
import { responseErrorGet } from '@/lib/response-error-generator';

export default withApi({ method: 'GET' }, async (req, res) => {
    try {
        const yearParam = req.query.year as string | undefined;
        const year = yearParam ? Number(yearParam) : undefined;
        const leaves = await AuthorizedLeave.find({
            userId: req.user!.userId,
            ...(year
                ? {
                      startDate: { $lte: `${year + 1}-01-01` },
                      endDate: { $gte: `${year}-01-01` },
                  }
                : {}),
        })
            .sort({ startDate: -1 })
            .lean<AuthorizedLeaveRow[]>();

        res.status(200).json({ success: true, data: { leaves } });
    } catch (error) {
        console.error('List my authorized leaves error:', error);
        return responseErrorGet(res);
    }
});
