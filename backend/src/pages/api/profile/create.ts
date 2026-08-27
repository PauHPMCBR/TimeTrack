import type { NextApiResponse } from 'next';
import { requireRole, AuthRequest } from '@/lib/auth';
import { User } from '@/models';
import crypto from 'crypto';
import dbConnect from '@/lib/mongodb';
import {
    responseErrorIncorrectParameter,
    responseErrorMethodNotAllowed,
    responseErrorPost,
} from '@/lib/response-error-generator';
import { runValidation, validateRequestBody } from '@/lib/validation';
import { CreateUserRequestSchema } from 'shared/src/schemas/api';
import { getAppSettings } from '@/lib/settings';
import { sendRegistrationInvite } from '@/lib/mail';

async function handler(req: AuthRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return responseErrorMethodNotAllowed(res);
    }

    if (
        !(await runValidation(
            validateRequestBody(CreateUserRequestSchema),
            req,
            res
        ))
    )
        return;

    try {
        await dbConnect();
        const { email, name, role, dni } = req.body;

        const existingUser = await User.findOne({
            email: String(email).toLowerCase(),
        });
        if (existingUser) {
            return responseErrorIncorrectParameter(res, 'email', [
                'AlreadyExists',
            ]);
        }

        const registrationToken = crypto.randomBytes(32).toString('hex');

        const settings = await getAppSettings();

        const newUser = await User.create({
            name,
            email: email.toLowerCase(),
            registrationToken,
            registered: false,
            role: role || 'employee',
            groups: [],
            dni,
            expectedWorkHours: settings.defaultExpectedHours,
        });

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const inviteParams = new URLSearchParams({ name, email });
        const registrationLink = `${frontendUrl}/register/${registrationToken}?${inviteParams.toString()}`;

        void sendRegistrationInvite({
            to: newUser.email,
            name: newUser.name,
            registrationLink,
        });

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
                    expectedWorkHours: newUser.expectedWorkHours,
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

export default requireRole(['admin'], handler);
