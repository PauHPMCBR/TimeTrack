import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { requireRole, AuthRequest } from '@/lib/auth';
import { ADMIN_ROLE } from 'shared/src/lib/constants';
import { YearlyVacationDays } from '@/models';
import {
    responseErrorMethodNotAllowed,
    responseErrorPost,
    responseErrorIncorrectParameter,
    responseErrorValidation,
} from '@/lib/response-error-generator';
import { runValidation, validateRequestBody } from '@/lib/validation';
import {
    dateKeyToLocalMidnight,
    YearlyVacationAdminRequestSchema,
} from 'shared/src/schemas/api';

async function handler(req: AuthRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return responseErrorMethodNotAllowed(res);
    }

    try {
        if (
            !(await runValidation(
                validateRequestBody(YearlyVacationAdminRequestSchema),
                req,
                res
            ))
        )
            return;
    } catch (error) {
        console.error('Validation error:', error);
        return responseErrorValidation(res, [
            error instanceof Error ? error.message : String(error),
        ]);
    }

    try {
        await dbConnect();

        const { year, obligatoryDays, electiveDaysTotalCount } = req.body;

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

        const existingVacation = await YearlyVacationDays.findOne({
            year,
            userId: { $exists: false },
        });

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

export default requireRole([ADMIN_ROLE], handler);
