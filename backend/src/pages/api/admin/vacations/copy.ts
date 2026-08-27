import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { requireRole, AuthRequest } from '@/lib/auth';
import { YearlyVacationDays } from '@/models';
import {
    responseErrorEntryNotFound,
    responseErrorMethodNotAllowed,
    responseErrorPost,
} from '@/lib/response-error-generator';
import { validateRequestBody } from '@/lib/validation';
import { CopyYearlyVacationRequestSchema } from 'shared/src/schemas/api';

async function handler(req: AuthRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return responseErrorMethodNotAllowed(res);
    }

    const validationMiddleware = validateRequestBody(
        CopyYearlyVacationRequestSchema
    );
    await new Promise((resolve) => {
        validationMiddleware(req, res, () => resolve(true));
    });
    if (res.headersSent) return;

    try {
        await dbConnect();

        const { fromYear, toYear } = req.body;
        const sourceYear = fromYear ?? toYear - 1;

        const source = await YearlyVacationDays.findOne({
            year: sourceYear,
            userId: { $exists: false },
        });

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

        const existing = await YearlyVacationDays.findOne({
            year: toYear,
            userId: { $exists: false },
        });

        if (existing) {
            await YearlyVacationDays.findByIdAndUpdate(existing._id, {
                obligatoryDays,
                electiveDaysTotalCount: source.electiveDaysTotalCount,
                selectedElectiveDays: [],
                updatedAt: new Date(),
            });
        } else {
            await YearlyVacationDays.create({
                year: toYear,
                obligatoryDays,
                electiveDaysTotalCount: source.electiveDaysTotalCount,
                selectedElectiveDays: [],
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

export default requireRole(['admin'], handler);
