import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { signToken } from '@/lib/auth';
import { User } from '@/models';
import {
    responseErrorIncorrectParameter,
    responseErrorInvalidResetToken,
    responseErrorMethodNotAllowed,
    responseErrorPost,
    responseErrorResetTokenExpired,
} from '@/lib/response-error-generator';
import { runValidation, validateRequestBody } from '@/lib/validation';
import { ResetPasswordRequestSchema } from 'shared/src/schemas/api';
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
                validateRequestBody(ResetPasswordRequestSchema),
                req,
                res
            ))
        )
            return;

        try {
            await dbConnect();
            const { token, email, password } = req.body;

            const user = await User.findOne({
                resetPasswordToken: token,
                registered: true,
            });

            if (!user) {
                return responseErrorInvalidResetToken(res);
            }

            if (
                !user.resetPasswordExpires ||
                user.resetPasswordExpires.getTime() < Date.now()
            ) {
                return responseErrorResetTokenExpired(res);
            }

            if (user.email.toLowerCase() !== String(email).toLowerCase()) {
                return responseErrorIncorrectParameter(res, 'email');
            }

            const errors = validatePassword(
                String(password),
                user.email,
                user.name
            );
            if (errors.length > 0) {
                return responseErrorIncorrectParameter(res, 'password', errors);
            }

            user.password = password;
            // Null (not undefined): Mongoose drops `undefined` on save, which
            // would leave the used token reusable.
            user.resetPasswordToken = null;
            user.resetPasswordExpires = null;
            user.failedLoginAttempts = 0;
            user.blocked = false;
            user.blockedSince = null;
            user.updatedAt = new Date();
            await user.save();

            const jwt = signToken({
                userId: user._id.toString(),
                email: user.email,
                role: user.role,
            });

            res.status(200).json({
                success: true,
                data: {
                    token: jwt,
                    user: toPublicUser(user),
                },
            });
        } catch (error) {
            console.error('Reset password error:', error);
            return responseErrorPost(res);
        }
    },
    { limit: 10, windowMs: MS_PER_HOUR }
);