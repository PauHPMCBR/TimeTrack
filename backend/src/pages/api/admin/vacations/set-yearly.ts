import { withApi } from '@/lib/api-handler';
import { User, YearlyVacationDays } from '@/models';
import { findGlobalTemplate } from '@/repositories/vacation-repository';
import {
    responseErrorIncorrectParameter,
    responseErrorPost,
} from '@/lib/response-error-generator';
import { YearlyVacationAdminRequestSchema } from 'shared/src/schemas/api';
import { recomputeWorkDayRecords } from '@/lib/work-day-records';
import { dateKey } from '@/lib/date-key';
import type { DateKey } from 'shared/src/lib/day-key';

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
        const previousObligatory = (existingVacation?.obligatoryDays ??
            []) as DateKey[];

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

        const affected = new Set<string>(
            [...obligatoryDays, ...previousObligatory].filter(
                (day) => day <= dateKey(new Date())
            )
        );
        if (affected.size > 0) {
            const users = (await User.find(
                { registered: true, deleted: { $ne: true } },
                '_id'
            ).lean()) as unknown as { _id: string }[];
            for (const user of users) {
                await recomputeWorkDayRecords(
                    user._id.toString(),
                    Array.from(affected) as DateKey[]
                );
            }
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
