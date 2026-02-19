import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { requireSameGroupOrAdmin, AuthRequest } from '@/lib/auth';
import { User } from '@/models';
import { responseErrorGet, responseErrorMethodNotAllowed, responseErrorEntryNotFound } from '@/lib/response-error-generator';
import { UserIdParamSchema } from 'shared/src/schemas/api';
import { validateQueryParams } from '@/lib/validation';

async function handler(req: AuthRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return responseErrorMethodNotAllowed(res);
  }

  const validationMiddleware = validateQueryParams(UserIdParamSchema);
      await new Promise((resolve, reject) => {
        validationMiddleware(req, res, (err?: any) => err ? reject(err) : resolve(true));
      });

  try {
    await dbConnect();
    const userId = req.query.userId as string;
    const user = await User.findById(userId)
      .select('-password -registrationToken')
      .populate('groups', 'name description');

    if (!user) {
      return responseErrorEntryNotFound(res, 'User');
    }

    res.status(200).json(user);
  } catch (error) {
    console.error('Get user profile error:', error);
    return responseErrorGet(res);
  }
}

export default requireSameGroupOrAdmin(handler);