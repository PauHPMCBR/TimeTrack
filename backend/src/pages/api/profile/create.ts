import crypto from 'crypto';
import { ADMIN_ROLE, EMPLOYEE_ROLE, TOKEN_BYTE_LENGTH } from 'shared/src/lib/constants';
import { User } from '@/models';
import { getFrontendUrl } from '@/lib/frontend-url';
import {
    responseErrorIncorrectParameter,
    responseErrorPost,
} from '@/lib/response-error-generator';
import { CreateUserRequestSchema } from 'shared/src/schemas/api';
import { getAppSettings } from '@/lib/settings';
import { sendRegistrationInvite } from '@/lib/mail';
import { withApi } from '@/lib/api-handler';
import { findActiveByEmail } from '@/repositories/user-repository';

export default withApi(
    {
        method: 'POST',
        guard: 'admin',
        body: CreateUserRequestSchema,
        audit: {
            action: 'user_created',
            targetType: 'user',
            // Set by the handler once the document exists (ctx.auditExtra).
            targetId: (_req, ctx) =>
                ctx.auditExtra.targetId as string | undefined,
            metadata: (_req, ctx) => ({
                role: ctx.auditExtra.role,
            }),
        },
    },
    async (req, res, { body, auditExtra }) => {
        try {
            const { email, name, role, dni } = body;

            // Email is unique per non-deleted user.
            const existingUser = await findActiveByEmail(
                String(email).toLowerCase()
            );
            if (existingUser) {
                return responseErrorIncorrectParameter(res, 'email', [
                    'AlreadyExists',
                ]);
            }

            const registrationToken = crypto.randomBytes(TOKEN_BYTE_LENGTH).toString('hex');

            const settings = await getAppSettings();

            const newUser = await User.create({
                name,
                email: email.toLowerCase(),
                registrationToken,
                registered: false,
                role: role || EMPLOYEE_ROLE,
                checkInRequired: (role || EMPLOYEE_ROLE) !== ADMIN_ROLE,
                groups: [],
                dni,
                weeklyExpectedHours: [...settings.defaultWeeklyExpectedHours],
                scheduleMode: settings.defaultScheduleMode,
                timetable: settings.defaultTimetable.map((day) =>
                    day.map((entry) => ({ ...entry }))
                ),
            });

            const frontendUrl = getFrontendUrl();
            const inviteParams = new URLSearchParams({ name, email });
            const registrationLink = `${frontendUrl}/register/${registrationToken}?${inviteParams.toString()}`;

            void sendRegistrationInvite({
                to: newUser.email,
                name: newUser.name,
                registrationLink,
            });

            auditExtra.targetId = newUser._id.toString();
            auditExtra.role = newUser.role;

            res.status(201).json({
                success: true,
                data: {
                    user: {
                        id: newUser._id,
                        name: newUser.name,
                        email: newUser.email,
                        role: newUser.role,
                        registered: newUser.registered,
                        dni: newUser.dni,
                    },
                    registrationLink,
                    registrationToken,
                },
            });
        } catch (error) {
            console.error('Create user error:', error);
            return responseErrorPost(res);
        }
    }
);
