'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { ADMIN_ROLE } from 'shared/src/lib/constants';

// Client-side auth guard: the JWT lives in localStorage, so a Next.js
// middleware can't see it — the redirect must happen here. Renders nothing
// until the current user is resolved, then redirects to "/" (login) if the
// user is unauthenticated (or not an admin for admin pages). The attempted
// URL is preserved in the `next` query param so the login page can redirect
// back after authenticating.
export default function RequireAuth({
    children,
    requireAdmin = false,
}: {
    children: React.ReactNode;
    requireAdmin?: boolean;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [allowed, setAllowed] = useState(false);

    useEffect(() => {
        let cancelled = false;

        apiClient.getCurrentUser().then((user) => {
            if (cancelled) return;
            if (!user) {
                const current = `${pathname}${searchParams ? `?${searchParams.toString()}` : ''}`;
                router.replace(`/?next=${encodeURIComponent(current)}`);
                return;
            }
            if (requireAdmin && user.role !== ADMIN_ROLE) {
                const current = `${pathname}${searchParams ? `?${searchParams.toString()}` : ''}`;
                router.replace(`/?next=${encodeURIComponent(current)}`);
                return;
            }
            setAllowed(true);
        });

        return () => {
            cancelled = true;
        };
    }, [router, pathname, searchParams, requireAdmin]);

    if (!allowed) return null;
    return <>{children}</>;
}