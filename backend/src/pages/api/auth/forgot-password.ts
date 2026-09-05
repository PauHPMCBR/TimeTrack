import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import dbConnect from '@/lib/mongodb';
import { User } from '@/models';
import {
    responseErrorMethodNotAllowed,
    responseErrorPost,
} from '@/lib/response-error-generator';
import { runValidation, validateRequestBody } from '@/lib/validation';
import { ForgotPasswordRequestSchema } from 'shared/src/schemas/api';
import { withRateLimit } from '@/lib/rate-limit';
import { sendPasswordReset } from '@/lib/mail';
import {
    MS_PER_HOUR,
    TOKEN_BYTE_LENGTH,
} from 'shared/src/lib/constants';
import {
    DEFAULT_FRONTEND_URL,
    RESET_TOKEN_TTL_HOURS,
} from 'shared/src/lib/defaults';

export default withRateLimit(
    async function handler(req: NextApiRequest, res: NextApiResponse) {
        if (req.method !== 'POST') {
            return responseErrorMethodNotAllowed(res);
        }

        if (
            !(await runValidation(
                validateRequestBody(ForgotPasswordRequestSchema),
                req,
                res
            ))
        )
            return;

        try {
            await dbConnect();
            const email = String(req.body.email).toLowerCase();

            // Only registered users can reset. Respond identically whether or
            // not the account exists, so the endpoint can't be used to probe
            // which emails are registered.
            const user = await User.findOne({
                email,
                registered: true,
                deleted: { $ne: true },
            });

            if (user) {
                const resetPasswordToken = crypto.randomBytes(TOKEN_BYTE_LENGTH).toString('hex');
                const resetPasswordExpires = new Date(
                    Date.now() + RESET_TOKEN_TTL_HOURS * MS_PER_HOUR
                );

                await User.updateOne(
                    { _id: user._id },
                    {
                        resetPasswordToken,
                        resetPasswordExpires,
                        updatedAt: new Date(),
                    }
                );

                const frontendUrl =
                    process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL;
                const resetParams = new URLSearchParams({
                    token: resetPasswordToken,
                    email: user.email,
                });
                const resetLink = `${frontendUrl}/reset-password?${resetParams.toString()}`;

                await sendPasswordReset({
                    to: user.email,
                    name: user.name,
                    resetLink,
                    expiresHours: RESET_TOKEN_TTL_HOURS,
                });
            }

            res.status(200).json({
                success: true,
                data: { message: 'ResetLinkSent' },
            });
        } catch (error) {
            console.error('Forgot password error:', error);
            return responseErrorPost(res);
        }
    },
    { limit: 5, windowMs: MS_PER_HOUR }
);