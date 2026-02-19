import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { AuthRequest, requireRole } from '@/lib/auth';
import { Group, User } from '@/models';
import { responseErrorGet, responseErrorMethodNotAllowed } from '@/lib/response-error-generator';
import { validateQueryParams } from '@/lib/validation';
import { GroupIdParamSchema } from 'shared/src/schemas/api';

async function handler(req: AuthRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return responseErrorMethodNotAllowed(res);
  }

  try {
    await dbConnect();

    const users = await User.find({}, '-password'); // No enviem la contrasenya
    res.status(200).json({
      users: users
    });
  } catch (error) {
    console.error('Admin get users error:', error);
    return responseErrorGet(res);
  }
}

export default requireRole(['admin'], handler);