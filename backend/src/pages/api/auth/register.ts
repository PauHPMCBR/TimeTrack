import bcrypt from 'bcryptjs';
import { signToken, setAuthCookie, isHttpsRequest } from '@/lib/auth';
import { User } from '@/models';
import {
    responseErrorIncorrectParameter,
    responseErrorInvalidRegisterToken,
    responseErrorMissingParameter,
    responseErrorPost,
} from '@/lib/response-error-generator';
import { RegisterRequestSchema } from 'shared/src/schemas/api';
import { MS_PER_HOUR } from 'shared/src/lib/constants';
import { toPublicUser } from '@/lib/sanitize';
import { withRateLimit } from '@/lib/rate-limit';
import { withApi } from '@/lib/api-handler';
import { validatePassword } from '@/lib/password';
import { findActiveByEmail } from '@/repositories/user-repository';

export default withRateLimit(
    withApi(
        { method: 'POST', guard: 'none', body: RegisterRequestSchema },
        async (req, res, { body }) => {
            try {
                const { registrationToken, email, password } = body;
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

                // Email is unique per non-deleted user.
                const existingUser = await findActiveByEmail(emailLower, {
                    registered: true,
                    excludeId: user._id,
                });

                if (existingUser) {
                    return responseErrorIncorrectParameter(res, 'email', [
                        'AlreadyExists',
                    ]);
                }

                // Persist with a targeted update instead of `user.save()`: a full save
                // re-validates every path (incl. required fields a bootstrap-inserted
                // user document may lack, e.g. `dni`) and would 500. The password is
                // hashed here to match the pre-save hook (cost 12).
                const hashedPassword = await bcrypt.hash(String(password), 12);
                await User.updateOne(
                    { _id: user._id },
                    {
                        $set: {
                            password: hashedPassword,
                            registered: true,
                            failedLoginAttempts: 0,
                            blocked: false,
                            // Pin the tracking start to the activation moment so
                            // monthly confirmations only evaluate from here on.
                            trackingStartDate: new Date(),
                            updatedAt: new Date(),
                        },
                        $unset: { blockedSince: 1 },
                    }
                );

                // Reflect the new state on the in-memory doc used for the response.
                user.registered = true;

                const token = signToken({
                    userId: user._id.toString(),
                    email: user.email,
                    role: user.role,
                });

                setAuthCookie(res, token, true, {
                    secure: isHttpsRequest(req),
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
        }
    ),
    { limit: 10, windowMs: MS_PER_HOUR }
);
