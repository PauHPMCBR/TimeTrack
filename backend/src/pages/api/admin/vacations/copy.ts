import { withApi } from '@/lib/api-handler';
import { YearlyVacationDays } from '@/models';
import { findGlobalTemplate } from '@/repositories/vacation-repository';
import {
    responseErrorEntryNotFound,
    responseErrorPost,
} from '@/lib/response-error-generator';
import { CopyYearlyVacationRequestSchema } from 'shared/src/schemas/api';

export default withApi(
    { method: 'POST', guard: 'admin', body: CopyYearlyVacationRequestSchema },
    async (_req, res, { body }) => {
    try {
        const { fromYear, toYear } = body;
        const sourceYear = fromYear ?? toYear - 1;

        const source = await findGlobalTemplate(sourceYear);

        if (!source) {
            return responseErrorEntryNotFound(res, 'YearlyVacationDays');
        }

        const obligatoryDays = (source.obligatoryDays ?? []).map(
            (date: Date) => {
                const shifted = new Date(date);
                shifted.setFullYear(toYear);
                return shifted;
            }
        );

        const existing = await findGlobalTemplate(toYear);

        if (existing) {
            await YearlyVacationDays.findByIdAndUpdate(existing._id, {
                obligatoryDays,
                electiveDaysTotalCount: source.electiveDaysTotalCount,
                updatedAt: new Date(),
            });
        } else {
            await YearlyVacationDays.create({
                year: toYear,
                obligatoryDays,
                electiveDaysTotalCount: source.electiveDaysTotalCount,
            });
        }

        res.status(200).json({
            success: true,
            data: {
                message: 'YearlyVacationCopied',
                year: toYear,
                sourceYear,
            },
        });
    } catch (error) {
        console.error('Copy yearly vacations error:', error);
        return responseErrorPost(res);
    }
    }
);
