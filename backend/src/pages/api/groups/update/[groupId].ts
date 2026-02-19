import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { requireRole, AuthRequest } from '@/lib/auth';
import { Group, User } from '@/models';
import { responseErrorDelete, responseErrorEntryNotFound, responseErrorMethodNotAllowed, responseErrorPut } from '@/lib/response-error-generator';
import { validateQueryParams, validateRequestBody } from '@/lib/validation';
import { GroupIdParamSchema, CreateGroupRequestSchema } from 'shared/src/schemas/api';

async function handler(req: AuthRequest, res: NextApiResponse) {

  const validationMiddleware = validateQueryParams(GroupIdParamSchema);
    await new Promise((resolve, reject) => {
      validationMiddleware(req, res, (err?: any) => err ? reject(err) : resolve(true));
    });

  if (req.method === 'PUT') {

    const validationMiddleware2 = validateRequestBody(CreateGroupRequestSchema);
     await new Promise((resolve, reject) => {
        validationMiddleware2(req, res, (err?: any) => err ? reject(err) : resolve(true));
      });

    try {
      await dbConnect();
      const groupId = req.query.groupId as string;
      const { name, description, members } = req.body;

      const group = await Group.findByIdAndUpdate(
        groupId,
        { name, description, members },
        { new: true }
      );

      if (!group) {
        return responseErrorEntryNotFound(res, "Group");
      }

      await User.updateMany(
        { groups: group._id },
        { $pull: { groups: group._id } }
      );

      if (members && members.length > 0) {
        await User.updateMany(
          { _id: { $in: members } },
          { $addToSet: { groups: group._id } }
        );
      }

      res.status(200).json({ group: group });
    } catch (error) {
      console.error('Update group error:', error);
      return responseErrorPut(res);
    }
  } else if (req.method === 'DELETE') {
    try {
      await dbConnect();
      const groupId = req.query.groupId as string;
      const group = await Group.findByIdAndDelete(groupId);

      if (!group) {
        return responseErrorEntryNotFound(res, "Group");
      }

      await User.updateMany(
        { groups: groupId },
        { $pull: { groups: groupId } }
      );

      res.status(200).json({ message: 'Grup eliminat' });
    } catch (error) {
      console.error('Delete group error:', error);
      return responseErrorDelete(res);
    }
  } else {
    return responseErrorMethodNotAllowed(res);
  }
}

export default requireRole(['admin'], handler);