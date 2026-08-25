import type { NextApiResponse } from 'next';
import { requireRole, AuthRequest } from '@/lib/auth';
import { User } from '@/models';
import crypto from 'crypto';
import dbConnect from '@/lib/mongodb';
import { responseErrorIncorrectParameter, responseErrorMethodNotAllowed, responseErrorPost } from '@/lib/response-error-generator';
import { validateRequestBody } from '@/lib/validation';
import { CreateUserRequestSchema } from 'shared/src/schemas/api';

async function handler(req: AuthRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return responseErrorMethodNotAllowed(res);
  }

  const validationMiddleware = validateRequestBody(CreateUserRequestSchema);
      await new Promise((resolve) => {
        validationMiddleware(req, res, () => resolve(true));
      });
      if (res.headersSent) return;

  try {
    await dbConnect();
    const { email, name, role } = req.body;

    const existingUser = await User.findOne({ email: String(email).toLowerCase() });
    if (existingUser) {
        return responseErrorIncorrectParameter(res, 'email', ['AlreadyExists']);
    }

    const registrationToken = crypto.randomBytes(32).toString('hex');

    const newUser = await User.create({
      name,
      email: email.toLowerCase(),
      registrationToken,
      registered: false,
      role: role || 'employee',
      groups: []
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const registrationLink = `${frontendUrl}/register/${registrationToken}`;

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          registered: newUser.registered
        },
        registrationLink,
        registrationToken,
      }
    });

  } catch (error) {
    console.error('Create user error:', error);
    return responseErrorPost(res);
  }
}

export default requireRole(['admin'], handler);
