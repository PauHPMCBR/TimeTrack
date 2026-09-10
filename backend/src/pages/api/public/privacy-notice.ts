import { withApi } from '@/lib/api-handler';
import { getAppSettings } from '@/lib/settings';

// Public (pre-registration) privacy notice for the registration page —
// RGPD arts. 13-14: the worker must be informed before their data is
// processed. Deliberately returns ONLY the notice text: no other company
// settings may leak through an unauthenticated endpoint. Empty string when
// the company has not configured a notice yet.
export default withApi({ method: 'GET', guard: 'none' }, async (_req, res) => {
    const settings = await getAppSettings();
    res.status(200).json({
        success: true,
        data: { privacyNoticeText: settings.privacyNoticeText ?? '' },
    });
});
