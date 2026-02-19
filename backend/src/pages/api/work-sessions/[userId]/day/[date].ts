import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { requireSameGroupOrAdmin, AuthRequest } from '@/lib/auth';
import { WorkSession } from '@/models';
import { responseErrorGet, responseErrorMethodNotAllowed } from '@/lib/response-error-generator';
import { DateParamSchema } from 'shared/src/schemas/api';
import { validateQueryParams } from '@/lib/validation';

async function handler(req: AuthRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return responseErrorMethodNotAllowed(res);
  }

  const validationMiddleware = validateQueryParams(DateParamSchema);
    await new Promise((resolve, reject) => {
      validationMiddleware(req, res, (err?: any) => err ? reject(err) : resolve(true));
    });

  try {
    await dbConnect();
    const userId = req.query.userId as string;
    const date = new Date(req.query.date as string);
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));

    const sessions = await WorkSession.find({
      userId: userId,
      timestamp: { $gte: startOfDay, $lte: endOfDay },
    }).sort({ timestamp: 1 });

    res.status(200).json({
      success: true,
      workSessions: sessions,
    });
  } catch (error) {
    console.error('Get user day sessions error:', error);
    return responseErrorGet(res);
  }
}

export default requireSameGroupOrAdmin(handler);