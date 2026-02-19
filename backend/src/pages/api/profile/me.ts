import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { authenticateToken, AuthRequest } from '@/lib/auth';
import { User } from '@/models';
import { responseErrorEntryNotFound, responseErrorGet, responseErrorMethodNotAllowed } from '@/lib/response-error-generator';

async function handler(req: AuthRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return responseErrorMethodNotAllowed(res);
  }

  try {
    await dbConnect();
    const user = await User.findById(req.user?.userId)
      .select('-password -registrationToken')
      .populate('groups', 'name description');

    if (!user) {
      return responseErrorEntryNotFound(res, "User");
    }

    res.status(200).json({ user: user });
  } catch (error) {
    console.error('Get profile error:', error);
    return responseErrorGet(res);
  }
}


export default authenticateToken(handler);