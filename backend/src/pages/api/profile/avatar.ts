import { withApi } from '@/lib/api-handler';
import { User } from '@/models';
import {
    responseErrorGet,
    responseErrorIncorrectParameter,
    responseErrorPost,
} from '@/lib/response-error-generator';
import { AvatarUploadRequestSchema } from 'shared/src/schemas/api';
import { AVATAR_MAX_BYTES, sanitizeAvatar, saveAvatar } from '@/lib/storage';

export const config = {
    api: {
        bodyParser: { sizeLimit: '16mb' },
    },
};

export default withApi(
    { method: 'POST', body: AvatarUploadRequestSchema },
    async (req, res, { body }) => {
        const dataUrl = body.dataUrl;

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
);
