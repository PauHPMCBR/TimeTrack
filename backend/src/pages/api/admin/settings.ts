import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { requireRole, AuthRequest } from '@/lib/auth';
import { ADMIN_ROLE } from 'shared/src/lib/constants';
import { AppSettings } from '@/models';
import { getAppSettings, invalidateAppSettingsCache } from '@/lib/settings';
import {
    responseErrorGet,
    responseErrorMethodNotAllowed,
    responseErrorPut,
} from '@/lib/response-error-generator';
import { runValidation, validateRequestBody } from '@/lib/validation';
import { AppSettingsRequestSchema } from 'shared/src/schemas/api';

async function handler(req: AuthRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        try {
            await dbConnect();
            const settings = await getAppSettings();
            res.status(200).json({
                success: true,
                data: { settings },
            });
        } catch (error) {
            console.error('Get settings error:', error);
            return responseErrorGet(res);
        }
    } else if (req.method === 'PUT') {
        if (
            !(await runValidation(
                validateRequestBody(AppSettingsRequestSchema),
                req,
                res
            ))
        )
            return;

        try {
            await dbConnect();
            const {
                defaultExpectedHours,
                benevolenceHours,
                toleranceHours,
                endOfDayHour,
                nonWorkingDays,
                inconsistencyReminderEnabled,
                monthlyApprovalReminderDays,
            } = req.body;

            const update: Record<string, unknown> = { updatedAt: new Date() };
            if (defaultExpectedHours !== undefined)
                update.defaultExpectedHours = defaultExpectedHours;
            if (benevolenceHours !== undefined)
                update.benevolenceHours = benevolenceHours;
            if (toleranceHours !== undefined)
                update.toleranceHours = toleranceHours;
            if (endOfDayHour !== undefined) update.endOfDayHour = endOfDayHour;
            if (nonWorkingDays !== undefined)
                update.nonWorkingDays = nonWorkingDays;
            if (inconsistencyReminderEnabled !== undefined)
                update.inconsistencyReminderEnabled =
                    inconsistencyReminderEnabled;
            if (monthlyApprovalReminderDays !== undefined)
                update.monthlyApprovalReminderDays =
                    monthlyApprovalReminderDays;

            const existing = await AppSettings.findOne({});
            if (existing) {
                await AppSettings.findByIdAndUpdate(existing._id, update, {
                    new: true,
                });
            } else {
                await AppSettings.create(update);
            }

            invalidateAppSettingsCache();

            const settings = await getAppSettings();
            res.status(200).json({
                success: true,
                data: { settings },
            });
        } catch (error) {
            console.error('Update settings error:', error);
            return responseErrorPut(res);
        }
    } else {
        return responseErrorMethodNotAllowed(res);
    }
}

export default requireRole([ADMIN_ROLE], handler);
