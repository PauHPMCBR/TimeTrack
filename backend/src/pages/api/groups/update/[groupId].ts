import { NextApiRequest, NextApiResponse } from 'next';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import { requireRole, AuthRequest } from '@/lib/auth';
import { Group, User } from '@/models';
import { responseErrorDelete, responseErrorEntryNotFound, responseErrorIncorrectParameter, responseErrorMethodNotAllowed, responseErrorPut } from '@/lib/response-error-generator';
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

      const groupObjectId = new mongoose.Types.ObjectId(groupId);
      const group = await Group.findById(groupObjectId);

      if (!group) {
        return responseErrorEntryNotFound(res, "Group");
      }

      if (members && members.length > 0) {
        const validMemberIds = members.filter((m: string) => mongoose.Types.ObjectId.isValid(m));
        
        const usersExist = await User.countDocuments({
          _id: { $in: validMemberIds }
        });

        if (usersExist !== validMemberIds.length) {
          return responseErrorIncorrectParameter(res, 'members', ['SomeUsersNotFound']);
        }
      }

      await Group.findByIdAndUpdate(
        groupObjectId,
        { name, description, members },
        { new: true }
      );

      await User.updateMany(
        { groups: groupObjectId },
        { $pull: { groups: groupObjectId } }
      );

      if (members && members.length > 0) {
        await User.updateMany(
          { _id: { $in: members } },
          { $addToSet: { groups: groupObjectId } }
        );
      }

      const updatedGroup = await Group.findById(groupObjectId);
      res.status(200).json({ group: updatedGroup });
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
        { groups: new mongoose.Types.ObjectId(groupId) },
        { $pull: { groups: new mongoose.Types.ObjectId(groupId) } }
      );

      res.status(200).json({ message: 'GroupDeleted' });
    } catch (error) {
      console.error('Delete group error:', error);
      return responseErrorDelete(res);
    }
  } else {
    return responseErrorMethodNotAllowed(res);
  }
}

export default requireRole(['admin'], handler);