import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { AuthRequest, authenticateToken } from '@/lib/auth';
import { ElectiveVacation } from '@/models';
import { responseErrorIllegalAction, responseErrorMethodNotAllowed, responseErrorPost } from '@/lib/response-error-generator';

async function handler(req: AuthRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return responseErrorMethodNotAllowed(res);
  }

  try {
    await dbConnect();
    const vacationId = req.query.vacationId as string;
    const userId = req.user!.userId;

    const vacation = await ElectiveVacation.findById(vacationId);

    if (vacation.userId != userId) {
      return responseErrorIllegalAction(res, 'ModifyingFromAnotherUser');
    }

    await ElectiveVacation.updateMany(
      { _id: vacationId },
      { status: 'cancelled' },
    );

    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Cancel elective vacation error:', error);
    return responseErrorPost(res);
  }
}

export default authenticateToken(handler);