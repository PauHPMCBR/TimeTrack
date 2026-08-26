import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { AuthRequest, requireRole } from '@/lib/auth';
import { ElectiveVacation, YearlyVacationDays } from '@/models';
import { responseErrorGet, responseErrorMethodNotAllowed } from '@/lib/response-error-generator';
import { YearlyVacationResponse } from 'shared/src/schemas/api';

async function handler(req: AuthRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return responseErrorMethodNotAllowed(res);
  }

  try {
    await dbConnect();
    const year = parseInt(req.query.year as string);
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999);

    const [vacations, yearlyVacationDays] = await Promise.all([
      ElectiveVacation.find({
        date: { $gte: startDate, $lte: endDate },
      }).sort({ date: 1 }).lean(),

      // find generic yearly vacation days
      YearlyVacationDays.findOne({
        userId: undefined,
        year: year,
      }).lean(),
    ]) as [any[], any];

    const response: YearlyVacationResponse = {
      year: year,
      electives: vacations,
      yearlyVacationDays: yearlyVacationDays
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Get vacations error:', error);
    return responseErrorGet(res);
  }
}

export default requireRole(['admin'], handler);