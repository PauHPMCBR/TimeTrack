import { clearAuthCookie } from '@/lib/auth';
import { withApi } from '@/lib/api-handler';

// POST /api/auth/logout — clears the httpOnly session cookie. The cookie was
// set with HttpOnly so the frontend cannot remove it itself; it must call this
// endpoint (with credentials) so the browser expires the cookie on the backend.
export default withApi({ method: 'POST', guard: 'none' }, async (
    _req,
    res
) => {
    clearAuthCookie(res);
    res.status(200).json({ success: true, data: { success: true } });
});
