import { withApi } from '@/lib/api-handler';
import { findGlobalTemplate } from '@/repositories/vacation-repository';
import { responseErrorEntryNotFound } from '@/lib/response-error-generator';

export default withApi({ method: 'GET' }, async (req, res) => {
    const year = parseInt(String(req.query.year));

    const yearlyVacationDays = await findGlobalTemplate(year).lean();

    if (!yearlyVacationDays) {
        return responseErrorEntryNotFound(res, 'YearlyVacationDays');
    }

    res.status(200).json({
        success: true,
        data: { vacations: yearlyVacationDays },
    });
});
