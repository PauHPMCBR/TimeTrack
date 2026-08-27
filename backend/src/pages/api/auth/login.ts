import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { signToken } from '@/lib/auth';
import { User } from '@/models';
import {
    responseErrorAccountBlocked,
    responseErrorInvalidCredentials,
    responseErrorMethodNotAllowed,
    responseErrorPost,
} from '@/lib/response-error-generator';
import { validateRequestBody, runValidation } from '@/lib/validation';
import { LoginRequestSchema } from 'shared/src/schemas/api';
import { toPublicUser } from '@/lib/sanitize';
import { withRateLimit } from '@/lib/rate-limit';

export default withRateLimit(
    async function handler(req: NextApiRequest, res: NextApiResponse) {
        if (req.method !== 'POST') {
            return responseErrorMethodNotAllowed(res);
        }

        try {
            if (
                !(await runValidation(
                    validateRequestBody(LoginRequestSchema),
                    req,
                    res
                ))
            )
                return;

            await dbConnect();
            const { email, password } = req.body;

            const user = await User.findOne({ email, registered: true });

            if (!user) {
                return responseErrorInvalidCredentials(res);
            }

            if (user.blocked) {
                const blockMinutes = parseInt(
                    process.env.BLOCK_MINUTES || '10'
                );
                const blockedSince = user.blockedSince
                    ? new Date(user.blockedSince)
                    : null;

                if (blockedSince) {
                    const unblockAt = new Date(
                        blockedSince.getTime() + blockMinutes * 60 * 1000
                    );
                    if (Date.now() >= unblockAt.getTime()) {
                        await User.findByIdAndUpdate(user._id, {
                            blocked: false,
                            failedLoginAttempts: 0,
                            blockedSince: null,
                        });
                    } else {
                        const remainingMs = unblockAt.getTime() - Date.now();
                        const remainingSec = Math.ceil(remainingMs / 1000);
                        return responseErrorAccountBlocked(
                            res,
                            unblockAt,
                            remainingSec
                        );
                    }
                } else {
                    return responseErrorAccountBlocked(res, null);
                }
            }

            const isValidPassword = await user.comparePassword(password);

            if (!isValidPassword) {
                const maxAttempts = parseInt(
                    process.env.MAX_FAILED_LOGIN_ATTEMPTS || '5'
                );
                const newFailedAttempts = (user.failedLoginAttempts || 0) + 1;

                const updateData: {
                    failedLoginAttempts: number;
                    blocked?: boolean;
                    blockedSince?: Date;
                } = {
                    failedLoginAttempts: newFailedAttempts,
                };

                if (newFailedAttempts >= maxAttempts) {
                    updateData.blocked = true;
                    updateData.blockedSince = new Date();
                }

                await User.findByIdAndUpdate(user._id, updateData);
                return responseErrorInvalidCredentials(res);
            }

            const updatedUser = await User.findByIdAndUpdate(
                user._id,
                { failedLoginAttempts: 0, blocked: false, blockedSince: null },
                { new: true }
            );

            const token = signToken({
                userId: updatedUser!._id.toString(),
                email: updatedUser!.email,
                role: updatedUser!.role,
            });

            res.status(200).json({
                success: true,
                data: {
                    token,
                    user: toPublicUser(user),
                },
            });
        } catch (error) {
            console.error(
                'Error stack:',
                error instanceof Error ? error.stack : String(error)
            );
            return responseErrorPost(res);
        }
    },
    { limit: 20, windowMs: 15 * 60 * 1000 }
);
