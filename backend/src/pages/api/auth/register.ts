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
import { runValidation, validateRequestBody } from '@/lib/validation';
import { RegisterRequestSchema } from 'shared/src/schemas/api';
import { MS_PER_HOUR } from 'shared/src/lib/constants';
import { toPublicUser } from '@/lib/sanitize';
import { withRateLimit } from '@/lib/rate-limit';
import { validatePassword } from '@/lib/password';

export default withRateLimit(
    async function handler(req: NextApiRequest, res: NextApiResponse) {
        if (req.method !== 'POST') {
            return responseErrorMethodNotAllowed(res);
        }

        if (
            !(await runValidation(
                validateRequestBody(RegisterRequestSchema),
                req,
                res
            ))
        )
            return;

        try {
            await dbConnect();
            const { registrationToken, email, password } = req.body;
            // Emails are stored lowercased; compare case-insensitively.
            const emailLower = String(email).toLowerCase();

            const user = await User.findOne({
                registrationToken,
                registered: false,
            });

            if (!user) {
                return responseErrorInvalidRegisterToken(res);
            }

            if (user.email !== emailLower) {
                return responseErrorIncorrectParameter(res, 'email');
            }

            // The name is fixed by the admin when creating the user and cannot be changed.
            const name = user.name;

            if (!password) {
                return responseErrorMissingParameter(res, 'password');
            }

            const errors = validatePassword(String(password), emailLower, name);

            if (errors.length > 0) {
                return responseErrorIncorrectParameter(res, 'password', errors);
            }

            const existingUser = await User.findOne({
                email: emailLower,
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
            user.blockedSince = undefined;
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
    { limit: 10, windowMs: MS_PER_HOUR }
);
