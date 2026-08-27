'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';

// Client-side auth guard: the JWT lives in localStorage, so a Next.js
// middleware can't see it — the redirect must happen here. Renders nothing
// until the current user is resolved, then redirects to "/" (login) if the
// user is unauthenticated (or not an admin for admin pages).
export default function RequireAuth({
    children,
    requireAdmin = false,
}: {
    children: React.ReactNode;
    requireAdmin?: boolean;
}) {
    const router = useRouter();
    const [allowed, setAllowed] = useState(false);

    useEffect(() => {
        let cancelled = false;

        apiClient.getCurrentUser().then((user) => {
            if (cancelled) return;
            if (!user) {
                router.replace('/');
                return;
            }
            if (requireAdmin && user.role !== 'admin') {
                router.replace('/');
                return;
            }
            setAllowed(true);
        });

        return () => {
            cancelled = true;
        };
    }, [router, requireAdmin]);

    if (!allowed) return null;
    return <>{children}</>;
}
