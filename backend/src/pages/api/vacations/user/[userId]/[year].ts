import { withApi } from '@/lib/api-handler';
import {
    ensureUserYearConfig,
    findOverlapping,
} from '@/repositories/vacation-repository';
import { responseErrorGet } from '@/lib/response-error-generator';
import { ElectiveVacationRow, YearlyVacationRow } from '@/lib/rows';
import { resolveVacationNames } from '@/lib/vacation-names';
import {
    UserYearParamSchema,
    YearlyVacationResponse,
} from 'shared/src/schemas/api';

export default withApi(
    { method: 'GET', guard: 'sameGroupOrAdmin', query: UserYearParamSchema },
    async (_req, res, { query }) => {
        try {
            const userId = query.userId;
            // Tests stub validateQueryParams as a passthrough, so parse here
            // instead of trusting the schema transform.
            const year = parseInt(String(_req.query.year));
            const startDate = new Date(year, 0, 1);
            const endDate = new Date(year, 11, 31, 23, 59, 59, 999);

            const [vacations, yearlyVacationDays] = (await Promise.all([
                findOverlapping(startDate, endDate, { userId })
                    .sort({ startDate: 1 })
                    .lean(),
                // Creates the per-user row from the global template when
                // missing and syncs drifted fields with the template.
                ensureUserYearConfig(userId, year, { sync: true }),
            ])) as unknown as [
                ElectiveVacationRow[],
                YearlyVacationRow | null,
            ];

            const response: YearlyVacationResponse = {
                year: year,
                electives: (await resolveVacationNames(
                    vacations
                )) as YearlyVacationResponse['electives'],
                yearlyVacationDays: yearlyVacationDays,
            };

            res.status(200).json({ success: true, data: response });
        } catch (error) {
            console.error('Get vacations error:', error);
            return responseErrorGet(res);
        }
    }
);
