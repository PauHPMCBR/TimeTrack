import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { requireSameGroupOrAdmin, AuthRequest } from '@/lib/auth';
import { User } from '@/models';
import { responseErrorEntryNotFound, responseErrorGet, responseErrorMethodNotAllowed } from '@/lib/response-error-generator';
import { UserIdParamSchema } from 'shared/src/schemas/api';
import { validateQueryParams } from '@/lib/validation';
import { AVATAR_MIME, readAvatar } from '@/lib/storage';

async function handler(req: AuthRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return responseErrorMethodNotAllowed(res);
  }

  const validationMiddleware = validateQueryParams(UserIdParamSchema);
  await new Promise((resolve) => {
    validationMiddleware(req, res, () => resolve(true));
  });
  if (res.headersSent) return;

  try {
    await dbConnect();

    const userId = req.query.userId as string;
    const user = await User.findById(userId).select('avatar');

    if (!user || !user.avatar) {
      return responseErrorEntryNotFound(res, 'Avatar');
    }

    let data: Buffer;
    try {
      data = await readAvatar(user.avatar);
    } catch {
      return responseErrorEntryNotFound(res, 'Avatar');
    }

    res.setHeader('Content-Type', AVATAR_MIME);
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    res.status(200).send(data);
  } catch (error) {
    console.error('Get avatar error:', error);
    return responseErrorGet(res);
  }
}

export default requireSameGroupOrAdmin(handler);