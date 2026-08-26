import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { AuthRequest, requireRole } from '@/lib/auth';
import { User } from '@/models';
import { responseErrorGet, responseErrorMethodNotAllowed } from '@/lib/response-error-generator';

async function handler(req: AuthRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return responseErrorMethodNotAllowed(res);
  }

  try {
    await dbConnect();

    const users = await User.find({}, '-password -registrationToken').lean(); // No enviem la contrasenya ni tokens de registre
    res.status(200).json({
      users: users
    });
  } catch (error) {
    console.error('Admin get users error:', error);
    return responseErrorGet(res);
  }
}

export default requireRole(['admin'], handler);