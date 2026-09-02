import { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
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
import { setAuthCookie, isHttpsRequest } from '@/lib/auth';

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

            // Persist with a targeted update instead of `user.save()`: a full
            // save re-validates every path (incl. required fields a legacy user
            // document may lack, e.g. `dni` on bootstrap-inserted admins) and
            // would 500. `updateOne` skips validators; the password is hashed
            // here to match what the pre-save hook does (cost 12).
            const hashedPassword = await bcrypt.hash(String(password), 12);
            await User.updateOne(
                { _id: user._id },
                {
                    $set: {
                        password: hashedPassword,
                        failedLoginAttempts: 0,
                        blocked: false,
                        updatedAt: new Date(),
                    },
                    $unset: {
                        // Null/undefined would leave a stale (possibly reusable)
                        // token behind; $unset removes the fields entirely.
                        resetPasswordToken: 1,
                        resetPasswordExpires: 1,
                        blockedSince: 1,
                    },
                }
            );

            const jwt = signToken({
                userId: user._id.toString(),
                email: user.email,
                role: user.role,
            });

            setAuthCookie(res, jwt, true, {
                secure: isHttpsRequest(req),
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