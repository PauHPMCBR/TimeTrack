import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { AuthRequest, requireRole } from '@/lib/auth';
import { ElectiveVacation } from '@/models';
import { responseErrorGet, responseErrorMethodNotAllowed } from '@/lib/response-error-generator';

async function handler(req: AuthRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return responseErrorMethodNotAllowed(res);
  }

  try {
    await dbConnect();

    const vacations = await ElectiveVacation.find({
      status: "pending",
    }).sort({ date: 1 });

    res.status(200).json({ vacations: vacations });
  } catch (error) {
    console.error('Get pending vacations error:', error);
    return responseErrorGet(res);
  }
}

export default requireRole(['admin'], handler);