'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import LoginForm from '@/components/LoginForm';

export default function LoginPage() {
    const router = useRouter();
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        let cancelled = false;

        apiClient.getCurrentUser().then((user) => {
            if (cancelled) return;
            if (user) {
                // Ignore `next` here: it is only set when RequireAuth bounced
                // the user, so following it could loop (e.g. a non-admin sent
                // away from an admin page).
                router.replace('/dashboard');
                return;
            }
            setChecking(false);
        });

        return () => {
            cancelled = true;
        };
    }, [router]);

    if (checking) return null;

    return (
        <div className="min-h-svh bg-gradient-to-b from-zinc-50 to-white text-zinc-900 dark:from-zinc-950 dark:to-zinc-900 dark:text-zinc-100">
            {/* TOP BAR: sense contenidor i sense padding */}
            <div className="sticky top-0 z-30 transform-gpu border-b border-zinc-200/60 bg-white/70 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
                <div className="flex h-12 w-full items-center justify-start">
                    <LanguageSwitcher />
                </div>
            </div>

            <main className="mx-auto flex min-h-[80svh] w-full max-w-3xl animate-fade-in items-center justify-center px-4">
                <LoginForm></LoginForm>
            </main>
        </div>
    );
}
