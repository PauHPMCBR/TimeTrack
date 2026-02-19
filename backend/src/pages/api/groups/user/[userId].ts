import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { AuthRequest, requireSameGroupOrAdmin } from '@/lib/auth';
import { Group } from '@/models';
import { responseErrorGet, responseErrorMethodNotAllowed } from '@/lib/response-error-generator';
import { validateQueryParams } from '@/lib/validation';
import { UserIdParamSchema } from 'shared/src/schemas/api';

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

    const groups = await Group.find({
        userId: userId,
    }).sort({ name: 1 });

    res.status(200).json({ groups: groups });
  } catch (error) {
    console.error('Get group error:', error);
    return responseErrorGet(res);
  }
}

export default requireSameGroupOrAdmin(handler);