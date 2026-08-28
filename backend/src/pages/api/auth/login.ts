import { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
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
import { MS_PER_MINUTE } from 'shared/src/lib/constants';
import { toPublicUser } from '@/lib/sanitize';
import { withRateLimit } from '@/lib/rate-limit';

// Fixed bcrypt hash (cost 12) compared against when no account matches, so a
// "user not found" response takes roughly as long as a real password check.
// Prevents timing-based account enumeration.
const DUMMY_PASSWORD_HASH =
    '$2a$12$MSVNFA8MsRGEIFZIvoa/VeFiX/sTS8/cyZtuI229ws0E91dcnF3Ki';

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
            // Emails are stored lowercased; compare case-insensitively so users
            // can log in with whatever casing they type.
            const emailLower = String(email).toLowerCase();

            const user = await User.findOne({
                email: emailLower,
                registered: true,
            });

            if (!user) {
                // Spend the same time as a real bcrypt compare to avoid leaking
                // whether the account exists.
                await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
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

                // Atomic increment avoids the race where concurrent bad logins
                // each read the same stale counter and undercount attempts.
                const updated = await User.findByIdAndUpdate(
                    user._id,
                    { $inc: { failedLoginAttempts: 1 } },
                    { new: true }
                );

                if (updated && updated.failedLoginAttempts >= maxAttempts) {
                    await User.findByIdAndUpdate(user._id, {
                        blocked: true,
                        blockedSince: new Date(),
                    });
                }

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
    { limit: 20, windowMs: 15 * MS_PER_MINUTE }
);
