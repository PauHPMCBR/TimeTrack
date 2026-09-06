import { withApi } from '@/lib/api-handler';
import { YearlyVacationDays } from '@/models';

// Years that have a company-wide vacation plan (global template rows).
export default withApi({ method: 'GET' }, async (_req, res) => {
    const years = (await YearlyVacationDays.distinct('year', {
        userId: { $exists: false },
    })) as number[];

    res.status(200).json({
        success: true,
        data: { years: years.sort((a, b) => b - a) },
    });
});
