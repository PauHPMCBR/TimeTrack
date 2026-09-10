import { withApi } from '@/lib/api-handler';
import { AppSettings } from '@/models';
import { getAppSettings, invalidateAppSettingsCache } from '@/lib/settings';
import { responseErrorIncorrectParameter, responseErrorMethodNotAllowed } from '@/lib/response-error-generator';
import { AppSettingsRequestSchema } from 'shared/src/schemas/api';
import type { NextApiRequest, NextApiResponse } from 'next';

const getHandler = withApi({ method: 'GET', guard: 'admin' }, async (
    _req,
    res
) => {
    const settings = await getAppSettings();
    res.status(200).json({
        success: true,
        data: { settings },
    });
});

const putHandler = withApi({
    method: 'PUT',
    guard: 'admin',
    body: AppSettingsRequestSchema,
    audit: {
        action: 'settings_updated',
        targetType: 'settings',
        metadata: (_req, ctx) => ({ fields: Object.keys(ctx.body as object) }),
    },
}, async (_req, res, { body }) => {
        const {
                defaultExpectedHours,
                benevolenceHours,
                toleranceHours,
                endOfDayHour,
                nonWorkingDays,
                inconsistencyReminderMode,
                monthlyApprovalReminderDays,
                timezone,
                privacyNoticeText,
                workerConsultationAcknowledged,
            } = body;

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
            if (inconsistencyReminderMode !== undefined)
                update.inconsistencyReminderMode = inconsistencyReminderMode;
            if (monthlyApprovalReminderDays !== undefined)
                update.monthlyApprovalReminderDays =
                    monthlyApprovalReminderDays;
            if (timezone !== undefined) {
                // Validate it is a known IANA time-zone before persisting.
                try {
                    Intl.DateTimeFormat(undefined, { timeZone: timezone });
                } catch {
                    return responseErrorIncorrectParameter(res, 'timezone', [
                        'InvalidTimezone',
                    ]);
                }
                update.timezone = timezone;
            }
            if (privacyNoticeText !== undefined)
                update.privacyNoticeText = privacyNoticeText;
            if (workerConsultationAcknowledged !== undefined)
                update.workerConsultationAcknowledged =
                    workerConsultationAcknowledged;

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
    }
);
export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') return getHandler(req, res);
    if (req.method === 'PUT') return putHandler(req, res);
    return responseErrorMethodNotAllowed(res);
}
