import type { NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { authenticateToken, AuthRequest } from '@/lib/auth';
import { User } from '@/models';
import {
    responseErrorGet,
    responseErrorIncorrectParameter,
    responseErrorMethodNotAllowed,
    responseErrorPost,
} from '@/lib/response-error-generator';
import { runValidation, validateRequestBody } from '@/lib/validation';
import { AvatarUploadRequestSchema } from 'shared/src/schemas/api';
import { AVATAR_MAX_BYTES, sanitizeAvatar, saveAvatar } from '@/lib/storage';

export const config = {
    api: {
        bodyParser: { sizeLimit: '16mb' },
    },
};

async function handler(req: AuthRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return responseErrorMethodNotAllowed(res);
    }

    if (
        !(await runValidation(
            validateRequestBody(AvatarUploadRequestSchema),
            req,
            res
        ))
    )
        return;

    const dataUrl = req.body.dataUrl as string;

    try {
        const b64 = dataUrl.split(',')[1];
        const buffer = Buffer.from(b64, 'base64');

        if (buffer.length === 0 || buffer.length > AVATAR_MAX_BYTES) {
            return responseErrorIncorrectParameter(res, 'avatar', [
                'AvatarTooLarge',
            ]);
        }

        let image: Buffer;
        try {
            image = await sanitizeAvatar(buffer);
        } catch {
            return responseErrorIncorrectParameter(res, 'avatar', [
                'InvalidAvatarFormat',
            ]);
        }

        await dbConnect();

        const userId = req.user!.userId;
        const filename = await saveAvatar(userId, image);

        const user = await User.findByIdAndUpdate(
            userId,
            { avatar: filename, updatedAt: new Date() },
            { new: true }
        );
        if (!user) {
            return responseErrorGet(res);
        }

        res.status(200).json({ success: true, data: { avatar: filename } });
    } catch (error) {
        console.error('Upload avatar error:', error);
        return responseErrorPost(res);
    }
}

export default authenticateToken(handler);
