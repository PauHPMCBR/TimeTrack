import { withApi } from '@/lib/api-handler';
import { YearlyVacationDays } from '@/models';
import { findGlobalTemplate } from '@/repositories/vacation-repository';
import {
    responseErrorIncorrectParameter,
    responseErrorPost,
} from '@/lib/response-error-generator';
import { YearlyVacationAdminRequestSchema } from 'shared/src/schemas/api';

export default withApi(
    {
        method: 'POST',
        guard: 'admin',
        body: YearlyVacationAdminRequestSchema,
    },
    async (_req, res, { body }) => {
    try {
        const { year, obligatoryDays, electiveDaysTotalCount } = body;

        const invalidObligatoryDays = obligatoryDays.filter(
            (day: string) => day.slice(0, 4) !== String(year)
        );

        if (invalidObligatoryDays.length > 0) {
            return responseErrorIncorrectParameter(res, 'obligatoryDays', [
                'DatesNotInYear',
            ]);
        }

        const existingVacation = await findGlobalTemplate(year);

        const update = {
            obligatoryDays,
            electiveDaysTotalCount,
            updatedAt: new Date(),
        };

        if (existingVacation) {
            await YearlyVacationDays.findByIdAndUpdate(
                existingVacation._id,
                update
            );
        } else {
            await YearlyVacationDays.create(update);
        }

        res.status(200).json({
            success: true,
            data: { message: 'YearlyVacationSaved', year },
        });
    } catch (error) {
        console.error('Set yearly vacations error:', error);
        return responseErrorPost(res);
    }
    }
);
