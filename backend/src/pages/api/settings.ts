import { withApi } from '@/lib/api-handler';
import { getAppSettings } from '@/lib/settings';

// Read-only company settings for any authenticated user (e.g. non-working days
// for the calendar). Same data as /api/admin/settings but not admin-gated.
export default withApi({ method: 'GET' }, async (_req, res) => {
    const settings = await getAppSettings();
    res.status(200).json({
        success: true,
        data: { settings },
    });
});
