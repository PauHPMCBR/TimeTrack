import { withApi } from '@/lib/api-handler';
import { yearRange } from 'shared/src/lib/date-ranges';
import { User } from '@/models';
import {
    findOverlapping,
    findGlobalTemplate,
} from '@/repositories/vacation-repository';
import { YearlyVacationResponse } from 'shared/src/schemas/api';
import { responseErrorGet } from '@/lib/response-error-generator';
import { ElectiveVacationRow, YearlyVacationRow } from '@/lib/rows';

export default withApi({ method: 'GET', guard: 'admin' }, async (_req, res) => {
    try {
        const year = parseInt(String(_req.query.year));
        const { start: startDate, end: endDate } = yearRange(year);

        const activeUsers = await User.find(
            { deleted: { $ne: true } },
            '_id'
        ).lean();
        const activeUserIds = activeUsers.map((u) => u._id);

        const [vacations, yearlyVacationDays] = (await Promise.all([
            findOverlapping(startDate, endDate, {
                // Intervals overlapping the requested year.
                userId: { $in: activeUserIds },
            })
                .sort({ startDate: 1 })
                .lean(),
            findGlobalTemplate(year).lean(),
        ])) as unknown as [ElectiveVacationRow[], YearlyVacationRow | null];

        const response: YearlyVacationResponse = {
            year: year,
            electives: vacations,
            yearlyVacationDays: yearlyVacationDays,
        };

        res.status(200).json({
            success: true,
            data: response,
        });
    } catch (error) {
        console.error('Get vacations error:', error);
        return responseErrorGet(res);
    }
});
