import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { requireRole, AuthRequest } from '@/lib/auth';
import { AppSettings } from '@/models';
import { getAppSettings } from '@/lib/settings';
import {
  responseErrorGet,
  responseErrorMethodNotAllowed,
  responseErrorPut,
} from '@/lib/response-error-generator';
import { validateRequestBody } from '@/lib/validation';
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
    const validationMiddleware = validateRequestBody(AppSettingsRequestSchema);
    await new Promise((resolve) => {
      validationMiddleware(req, res, () => resolve(true));
    });
    if (res.headersSent) return;

    try {
      await dbConnect();
      const { defaultExpectedHours, benevolenceHours, endOfDayHour } = req.body;

      const update: Record<string, unknown> = { updatedAt: new Date() };
      if (defaultExpectedHours !== undefined) update.defaultExpectedHours = defaultExpectedHours;
      if (benevolenceHours !== undefined) update.benevolenceHours = benevolenceHours;
      if (endOfDayHour !== undefined) update.endOfDayHour = endOfDayHour;

      const existing = await AppSettings.findOne({});
      if (existing) {
        await AppSettings.findByIdAndUpdate(existing._id, update, { new: true });
      } else {
        await AppSettings.create(update);
      }

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

export default requireRole(['admin'], handler);