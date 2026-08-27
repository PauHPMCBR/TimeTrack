import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { requireRole, AuthRequest } from '@/lib/auth';
import { YearlyVacationDays } from '@/models';
import {
    responseErrorMethodNotAllowed,
    responseErrorPost,
    responseErrorIncorrectParameter,
    responseErrorValidation,
} from '@/lib/response-error-generator';
import { validateRequestBody } from '@/lib/validation';
import { YearlyVacationAdminRequestSchema } from 'shared/src/schemas/api';

async function handler(req: AuthRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return responseErrorMethodNotAllowed(res);
    }

    try {
        const validationMiddleware = validateRequestBody(
            YearlyVacationAdminRequestSchema
        );
        await new Promise((resolve) => {
            validationMiddleware(req, res, () => resolve(true));
        });
        if (res.headersSent) return;
    } catch (error: any) {
        console.error('Validation error:', error);
        return responseErrorValidation(res, [error.message]);
    }

    try {
        await dbConnect();

        const { year, obligatoryDays, electiveDaysTotalCount } = req.body;

        // Validate that userId is not provided (this is for global template)
        if (req.body.userId) {
            return responseErrorIncorrectParameter(res, 'userId', [
                'ShouldNotBeSet',
            ]);
        }

        const invalidObligatoryDays = obligatoryDays.filter((date: string) => {
            const dateObj = new Date(date);
            return dateObj.getFullYear() !== year;
        });

        if (invalidObligatoryDays.length > 0) {
            return responseErrorIncorrectParameter(res, 'obligatoryDays', [
                'DatesNotInYear',
            ]);
        }

        const existingVacation = await YearlyVacationDays.findOne({
            year,
            userId: { $exists: false },
        });

        if (existingVacation) {
            existingVacation.obligatoryDays = obligatoryDays.map(
                (date: string) => new Date(date)
            );
            existingVacation.electiveDaysTotalCount = electiveDaysTotalCount;
            existingVacation.selectedElectiveDays = [];
            existingVacation.updatedAt = new Date();

            await YearlyVacationDays.findByIdAndUpdate(
                existingVacation._id,
                existingVacation
            );
        } else {
            await YearlyVacationDays.create({
                year,
                obligatoryDays: obligatoryDays.map(
                    (date: string) => new Date(date)
                ),
                electiveDaysTotalCount,
                selectedElectiveDays: [],
            });
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

export default requireRole(['admin'], handler);
