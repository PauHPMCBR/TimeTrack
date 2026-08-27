import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { signToken } from '@/lib/auth';
import { User } from '@/models';
import {
    responseErrorIncorrectParameter,
    responseErrorInvalidRegisterToken,
    responseErrorMethodNotAllowed,
    responseErrorMissingParameter,
    responseErrorPost,
} from '@/lib/response-error-generator';
import { PasswordIncorrectParameterReason } from 'shared/src/types/response-errors';
import { validateRequestBody } from '@/lib/validation';
import { RegisterRequestSchema } from 'shared/src/schemas/api';
import { toPublicUser } from '@/lib/sanitize';
import { withRateLimit } from '@/lib/rate-limit';

export default withRateLimit(
    async function handler(req: NextApiRequest, res: NextApiResponse) {
        if (req.method !== 'POST') {
            return responseErrorMethodNotAllowed(res);
        }

        const validationMiddleware = validateRequestBody(RegisterRequestSchema);
        await new Promise((resolve) => {
            validationMiddleware(req, res, () => resolve(true));
        });
        if (res.headersSent) return;

        try {
            await dbConnect();
            const { registrationToken, email, password } = req.body;

            const user = await User.findOne({
                registrationToken,
                registered: false,
            });

            if (!user) {
                return responseErrorInvalidRegisterToken(res);
            }

            if (user.email !== email) {
                return responseErrorIncorrectParameter(res, 'email');
            }

            // The name is fixed by the admin when creating the user and cannot be changed.
            const name = user.name;

            if (!password) {
                return responseErrorMissingParameter(res, 'password');
            }

            const pwd = String(password);
            const errors: PasswordIncorrectParameterReason[] = [];

            if (pwd.length < 8) {
                errors.push('TooShort');
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
                _id: { $ne: user._id },
            });

            if (existingUser) {
                return responseErrorIncorrectParameter(res, 'email', [
                    'AlreadyExists',
                ]);
            }

            user.failedLoginAttempts = 0;
            user.blocked = false;
            user.blockedSince = undefined as any;
            user.registered = true;
            user.password = password;
            await user.save();

            const token = signToken({
                userId: user._id.toString(),
                email: user.email,
                role: user.role,
            });

            res.status(200).json({
                success: true,
                data: {
                    token,
                    user: toPublicUser(user),
                },
            });
        } catch (error) {
            console.error('Register error:', error);
            return responseErrorPost(res);
        }
    },
    { limit: 10, windowMs: 60 * 60 * 1000 }
);
