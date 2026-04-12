import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import jwt from 'jsonwebtoken';
import { User } from '@/models';
import { responseErrorIncorrectParameter, responseErrorInvalidRegisterToken, responseErrorMethodNotAllowed, responseErrorMissingParameter, responseErrorPost } from '@/lib/response-error-generator';
import { PasswordIncorrectParameterReason } from 'shared/src/types/response-errors';
import { validateRequestBody } from '@/lib/validation';
import { RegisterRequestSchema } from 'shared/src/schemas/api';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return responseErrorMethodNotAllowed(res);
  }

  const validationMiddleware = validateRequestBody(RegisterRequestSchema);
    await new Promise((resolve, reject) => {
      validationMiddleware(req, res, (err?: any) => err ? reject(err) : resolve(true));
    });

  try {
    await dbConnect();
    const { registrationToken, email, name, password } = req.body;

    const user = await User.findOne({ 
      registrationToken,
      registered: false 
    });

    if (!user) {
      return responseErrorInvalidRegisterToken(res);
    }

    if (user.email !== email) {
      return responseErrorIncorrectParameter(res, 'email');
    }

    if (!password) {
      return responseErrorMissingParameter(res, 'password');
    }

    const pwd = String(password);
    const errors: PasswordIncorrectParameterReason[] = [];

    if (pwd.length < 12) {
      errors.push('LessThan12Characters');
    }
    if (!/[a-z]/.test(pwd)) {
      errors.push('MissingLowercase');
    }
    if (!/[A-Z]/.test(pwd)) {
      errors.push('MissingUppercase');
    }
    if (!/\d/.test(pwd)) {
      errors.push('MissingNumber');
    }
    if (!/[^A-Za-z0-9]/.test(pwd)) {
      errors.push('MissingSign');
    }

    const lowerPwd = pwd.toLowerCase();
    const lowerEmail = String(email || '').toLowerCase();
    const lowerName = String(name || '').toLowerCase();

    if (lowerPwd.includes(lowerEmail) && lowerEmail.length > 0) {
      errors.push('ContainsEmail');
    }
    if (lowerPwd.includes(lowerName) && lowerName.length > 0) {
      errors.push('ContainsUsername');
    }

    if (errors.length > 0) {
      return responseErrorIncorrectParameter(res, 'password', errors);
    }

    const existingUser = await User.findOne({ 
      email: email.toLowerCase(),
      registered: true,
      _id: { $ne: user._id }
    });

    if (existingUser) {
      return responseErrorIncorrectParameter(res, 'email', ['AlreadyExists']);
    }

    user.name = name;
    user.failedLoginAttempts = 0;
    user.blocked = false;
    user.blockedSince = undefined as any;
    user.registered = true;
    user.password = password;
    await user.save();

    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      console.error('JWT_SECRET environment variable is not set');
      return responseErrorPost(res);
    }
    const token = jwt.sign(
      { 
        userId: user._id, 
        email: user.email, 
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      token,
      user: user
    });
  } catch (error) {
    console.error('Register error:', error);
    return responseErrorPost(res);
  }
}