import { withApi } from '@/lib/api-handler';
import { withRateLimit } from '@/lib/rate-limit';
import {
    RegisterStatusQuerySchema,
    type RegisterTokenStatus,
} from 'shared/src/schemas/api';
import { MS_PER_HOUR } from 'shared/src/lib/constants';
import { User } from '@/models';
import {
    findActiveByEmail,
    notDeleted,
} from '@/repositories/user-repository';
import { responseErrorGet } from '@/lib/response-error-generator';

export default withRateLimit(
    withApi(
        { method: 'GET', guard: 'none', query: RegisterStatusQuerySchema },
        async (_req, res, { query }) => {
            try {
                const { token, email } = query;
                let status: RegisterTokenStatus = 'invalid';

                if (email) {
                    const user = await findActiveByEmail(email);
                    if (user?.registered) {
                        status = 'alreadyRegistered';
                    } else if (user?.registrationToken === token) {
                        status = 'pending';
                    }
                } else {
                    const pending = await User.findOne({
                        registrationToken: token,
                        registered: false,
                        ...notDeleted,
                    });
                    if (pending) status = 'pending';
                }

                res.status(200).json({
                    success: true,
                    data: { status },
                });
            } catch (error) {
                console.error('Register status error:', error);
                return responseErrorGet(res);
            }
        }
    ),
    { limit: 60, windowMs: MS_PER_HOUR }
);
