import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { requireRole, AuthRequest } from '@/lib/auth';
import { Group, User } from '@/models';
import { responseErrorMethodNotAllowed, responseErrorPost } from '@/lib/response-error-generator';
import { validateRequestBody } from '@/lib/validation';
import { CreateGroupRequestSchema } from 'shared/src/schemas/api';

async function handler(req: AuthRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return responseErrorMethodNotAllowed(res);
  }

  const validationMiddleware = validateRequestBody(CreateGroupRequestSchema);
       await new Promise((resolve, reject) => {
          validationMiddleware(req, res, (err?: any) => err ? reject(err) : resolve(true));
        });

  try {
    await dbConnect();
    const { name, description, members } = req.body;

    const group = new Group({
      name,
      description,
      members: members || [],
    });

    await group.save();

    if (members && members.length > 0) {
      await User.updateMany(
        { _id: { $in: members } },
        { $addToSet: { groups: group._id } }
      );
    }

    res.status(201).json({ group: group });
  } catch (error) {
    console.error('Create group error:', error);
    return responseErrorPost(res);
  }
}

export default requireRole(['admin'], handler);