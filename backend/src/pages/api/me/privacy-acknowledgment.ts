import { withApi } from '@/lib/api-handler';
import { User } from '@/models';
import {
    responseErrorEntryNotFound,
    responseErrorPost,
} from '@/lib/response-error-generator';

// Records the worker's in-app acknowledgment of the privacy notice (RGPD
// arts. 13-14 accountability). Idempotent: the first acknowledgment timestamp
// is kept, repeated calls don't overwrite it.
export default withApi({ method: 'POST' }, async (req, res) => {
    try {
        const user = await User.findById(req.user?.userId);
        if (!user || user.deleted) {
            return responseErrorEntryNotFound(res, 'User');
        }

        if (!user.privacyNoticeAcknowledgedAt) {
            user.privacyNoticeAcknowledgedAt = new Date();
            user.updatedAt = new Date();
            await user.save();
        }

        res.status(200).json({
            success: true,
            data: { acknowledgedAt: user.privacyNoticeAcknowledgedAt },
        });
    } catch (error) {
        console.error('Privacy acknowledgment error:', error);
        return responseErrorPost(res);
    }
});
