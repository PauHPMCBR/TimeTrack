import crypto from 'crypto';
import { User } from '@/models';
import { responseErrorPost } from '@/lib/response-error-generator';
import { ForgotPasswordRequestSchema } from 'shared/src/schemas/api';
import { withRateLimit } from '@/lib/rate-limit';
import { withApi } from '@/lib/api-handler';
import { findActiveByEmail } from '@/repositories/user-repository';
import { sendPasswordReset } from '@/lib/mail';
import {
    MS_PER_HOUR,
    TOKEN_BYTE_LENGTH,
} from 'shared/src/lib/constants';
import { RESET_TOKEN_TTL_HOURS } from 'shared/src/lib/defaults';
import { getFrontendUrl } from '@/lib/frontend-url';

export default withRateLimit(
    withApi(
        { method: 'POST', guard: 'none', body: ForgotPasswordRequestSchema },
        async (_req, res, { body }) => {
            try {
                const email = String(body.email).toLowerCase();

                // Only registered users can reset. Respond identically whether or
                // not the account exists, so the endpoint can't be used to probe
                // which emails are registered.
                const user = await findActiveByEmail(email, {
                    registered: true,
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

                    const frontendUrl = getFrontendUrl();
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
        }
    ),
    { limit: 5, windowMs: MS_PER_HOUR }
);
