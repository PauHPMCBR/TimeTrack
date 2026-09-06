import { withApi } from '@/lib/api-handler';
import { YearlyVacationDays } from '@/models';
import { findGlobalTemplate } from '@/repositories/vacation-repository';
import {
    responseErrorIncorrectParameter,
    responseErrorPost,
} from '@/lib/response-error-generator';
import {
    dateKeyToLocalMidnight,
    YearlyVacationAdminRequestSchema,
} from 'shared/src/schemas/api';

export default withApi(
    {
        method: 'POST',
        guard: 'admin',
        body: YearlyVacationAdminRequestSchema,
    },
    async (_req, res, { body }) => {
    try {
        const { year, obligatoryDays, electiveDaysTotalCount } = body;

        // Normalize defensively: the schema already converts to local-midnight
        // Dates; this also covers mocked/raw string inputs.
        const normalized = obligatoryDays.map((day: string | Date) =>
            typeof day === 'string' ? dateKeyToLocalMidnight(day) : new Date(day)
        );

        const invalidObligatoryDays = normalized.filter(
            (date: Date) => date.getFullYear() !== year
        );

        if (invalidObligatoryDays.length > 0) {
            return responseErrorIncorrectParameter(res, 'obligatoryDays', [
                'DatesNotInYear',
            ]);
        }

        const existingVacation = await findGlobalTemplate(year);

        const update = {
            obligatoryDays: normalized,
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
