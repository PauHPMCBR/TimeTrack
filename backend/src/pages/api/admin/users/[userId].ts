import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { requireRole, AuthRequest } from '@/lib/auth';
import { ADMIN_ROLE } from 'shared/src/lib/constants';
import { DEFAULT_FRONTEND_URL } from 'shared/src/lib/defaults';
import { User } from '@/models';
import { toPublicUser } from '@/lib/sanitize';
import {
    responseErrorEntryNotFound,
    responseErrorGet,
    responseErrorIncorrectParameter,
    responseErrorMethodNotAllowed,
    responseErrorPut,
} from '@/lib/response-error-generator';
import {
    runValidation,
    validateQueryParams,
    validateRequestBody,
} from '@/lib/validation';
import {
    UpdateUserRequestSchema,
    UserIdParamSchema,
} from 'shared/src/schemas/api';

async function handler(req: AuthRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        if (
            !(await runValidation(
                validateQueryParams(UserIdParamSchema),
                req,
                res
            ))
        )
            return;

        try {
            await dbConnect();
            const userId = req.query.userId as string;

            const user = await User.findById(userId);
            if (!user) {
                return responseErrorEntryNotFound(res, 'User');
            }

            let registrationLink: string | null = null;
            if (!user.registered && user.registrationToken) {
                const frontendUrl =
                    process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL;
                const inviteParams = new URLSearchParams({
                    name: user.name,
                    email: user.email,
                });
                registrationLink = `${frontendUrl}/register/${user.registrationToken}?${inviteParams.toString()}`;
            }

            res.status(200).json({
                success: true,
                data: { registrationLink },
            });
        } catch (error) {
            console.error('Get user registration link error:', error);
            return responseErrorGet(res);
        }
        return;
    }

    if (req.method !== 'PUT') {
        return responseErrorMethodNotAllowed(res);
    }

    if (
        !(await runValidation(validateQueryParams(UserIdParamSchema), req, res))
    )
        return;

    if (
        !(await runValidation(
            validateRequestBody(UpdateUserRequestSchema),
            req,
            res
        ))
    )
        return;

    try {
        await dbConnect();
        const userId = req.query.userId as string;
        const { name, email, role, dni, expectedWorkHours, workDays } =
            req.body;

        const user = await User.findById(userId);
        if (!user) {
            return responseErrorEntryNotFound(res, 'User');
        }

        if (
            email !== undefined &&
            email.toLowerCase() !== user.email.toLowerCase()
        ) {
            const existingEmail = await User.findOne({
                email: email.toLowerCase(),
                _id: { $ne: user._id },
            });
            if (existingEmail) {
                return responseErrorIncorrectParameter(res, 'email', [
                    'AlreadyExists',
                ]);
            }
        }

        const update: Record<string, unknown> = { updatedAt: new Date() };
        if (name !== undefined) update.name = name;
        if (email !== undefined) update.email = email.toLowerCase();
        if (role !== undefined) update.role = role;
        if (dni !== undefined) update.dni = dni;
        if (expectedWorkHours !== undefined)
            update.expectedWorkHours = expectedWorkHours;
        if (workDays !== undefined) update.workDays = workDays;

        await User.findByIdAndUpdate(user._id, update, { new: true });
        const updatedUser = await User.findById(user._id);

        res.status(200).json({
            success: true,
            data: {
                user: toPublicUser(updatedUser),
            },
        });
    } catch (error) {
        console.error('Update user error:', error);
        return responseErrorPut(res);
    }
}

export default requireRole([ADMIN_ROLE], handler);
