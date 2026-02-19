import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { authenticateToken, AuthRequest } from '@/lib/auth';
import { YearlyVacationDays } from '@/models';
import { responseErrorEntryNotFound, responseErrorGet, responseErrorMethodNotAllowed } from '@/lib/response-error-generator';

async function handler(req: AuthRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return responseErrorMethodNotAllowed(res);
  }

  try {
    await dbConnect();
    const year = parseInt(req.query.year as string);

    const yearlyVacationDays = await YearlyVacationDays.findOne({
      userId: undefined,
      year
    });

    if (!yearlyVacationDays) {
      return responseErrorEntryNotFound(res, 'YearlyVacationDays');
    }

    res.status(200).json({ vacations: yearlyVacationDays });
  } catch (error) {
    console.error('Get vacations error:', error);
    return responseErrorGet(res);
  }
}

export default authenticateToken(handler);
