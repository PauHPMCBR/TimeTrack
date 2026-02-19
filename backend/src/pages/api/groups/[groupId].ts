import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { AuthRequest, requireSameGroupOrAdmin } from '@/lib/auth';
import { Group } from '@/models';
import { responseErrorEntryNotFound, responseErrorGet, responseErrorMethodNotAllowed } from '@/lib/response-error-generator';
import { validateQueryParams } from '@/lib/validation';
import { GroupIdParamSchema } from 'shared/src/schemas/api';

async function handler(req: AuthRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return responseErrorMethodNotAllowed(res);
  }

  const validationMiddleware = validateQueryParams(GroupIdParamSchema);
    await new Promise((resolve, reject) => {
      validationMiddleware(req, res, (err?: any) => err ? reject(err) : resolve(true));
    });

  try {
    await dbConnect();
    const groupId = req.query.groupId as string;

    const group = await Group.findById(groupId);

    if (!group) {
      return responseErrorEntryNotFound(res, "Group");
    }

    res.status(200).json({ group: group });
  } catch (error) {
    console.error('Get group error:', error);
    return responseErrorGet(res);
  }
}

export default requireSameGroupOrAdmin(handler);