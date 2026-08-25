import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { AuthRequest, requireInGroupOrAdmin } from '@/lib/auth';
import { Group } from '@/models';
import { responseErrorEntryNotFound, responseErrorGet, responseErrorMethodNotAllowed } from '@/lib/response-error-generator';
import { validateQueryParams } from '@/lib/validation';
import { GroupIdParamSchema } from 'shared/src/schemas/api';

async function handler(req: AuthRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return responseErrorMethodNotAllowed(res);
  }

  const validationMiddleware = validateQueryParams(GroupIdParamSchema);
    await new Promise((resolve) => {
      validationMiddleware(req, res, () => resolve(true));
    });
    if (res.headersSent) return;

  try {
    await dbConnect();
    const groupId = req.query.groupId as string;

    let group = await Group.findById(groupId);

    if (!group) {
      return responseErrorEntryNotFound(res, "Group");
    }

    group = await Group.findById(groupId).populate('members', 'name email role registered');

    res.status(200).json({ group: group });
  } catch (error) {
    console.error('Get group error:', error);
    return responseErrorGet(res);
  }
}

export default requireInGroupOrAdmin(handler);