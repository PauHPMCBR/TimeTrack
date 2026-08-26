import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { requireRole, AuthRequest } from '@/lib/auth';
import { User } from '@/models';
import { toPublicUser } from '@/lib/sanitize';
import {
  responseErrorEntryNotFound,
  responseErrorIncorrectParameter,
  responseErrorMethodNotAllowed,
  responseErrorPut,
} from '@/lib/response-error-generator';
import { validateQueryParams, validateRequestBody } from '@/lib/validation';
import { UpdateUserRequestSchema, UserIdParamSchema } from 'shared/src/schemas/api';

async function handler(req: AuthRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    return responseErrorMethodNotAllowed(res);
  }

  const queryValidation = validateQueryParams(UserIdParamSchema);
  await new Promise((resolve) => {
    queryValidation(req, res, () => resolve(true));
  });
  if (res.headersSent) return;

  const bodyValidation = validateRequestBody(UpdateUserRequestSchema);
  await new Promise((resolve) => {
    bodyValidation(req, res, () => resolve(true));
  });
  if (res.headersSent) return;

  try {
    await dbConnect();
    const userId = req.query.userId as string;
    const { name, email, role, dni, expectedWorkHours } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return responseErrorEntryNotFound(res, 'User');
    }

    if (email !== undefined && email.toLowerCase() !== user.email.toLowerCase()) {
      const existingEmail = await User.findOne({
        email: email.toLowerCase(),
        _id: { $ne: user._id },
      });
      if (existingEmail) {
        return responseErrorIncorrectParameter(res, 'email', ['AlreadyExists']);
      }
    }

    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) update.name = name;
    if (email !== undefined) update.email = email.toLowerCase();
    if (role !== undefined) update.role = role;
    if (dni !== undefined) update.dni = dni;
    if (expectedWorkHours !== undefined) update.expectedWorkHours = expectedWorkHours;

    await User.findByIdAndUpdate(user._id, update, { new: true });
    const updatedUser = await User.findById(user._id);

    res.status(200).json({
      success: true,
      data: {
        user: toPublicUser(updatedUser),
      },
    });
  } catch (error) {
    console.error('Update user error:', error);
    return responseErrorPut(res);
  }
}

export default requireRole(['admin'], handler);