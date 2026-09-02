'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import Avatar from '@/components/Avatar';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import { User } from '@/types';
import { REMEMBERED_EMAIL_KEY } from '@/lib/storage';
import { APP_NAME, APP_ICON_URL, APP_ICON_TOOLBAR_URL } from '@/lib/brand';

export default function HeaderBar() {
    const { t } = useI18n();
    const [email, setEmail] = useState<string | null>();
    const [user, setUser] = useState<User | null>(null);
    const [open, setOpen] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const storedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY);
        setEmail(storedEmail || 'Sense Sessió');
    }, []);

    useEffect(() => {
        apiClient.getCurrentUser().then((u) => setUser(u || null));
    }, []);

    const handleLogout = async () => {
        await apiClient.logoff();
        setOpen(false);
        router.push('/');
    };

    const initial =
        email && email !== 'Sense Sessió'
            ? email.trim()[0]?.toUpperCase()
            : 'U';

    return (
        <div className="relative w-full flex items-center justify-between px-2 sm:px-3">
            <LanguageSwitcher />

            {APP_ICON_URL ? (
                <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    <img
                        src={APP_ICON_TOOLBAR_URL || APP_ICON_URL}
                        alt={APP_NAME}
                        className="h-6 w-auto sm:h-7"
                    />
                </div>
            ) : (
                <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden sm:block">
                    <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                        {APP_NAME}
                    </span>
                </div>
            )}

            <div className="relative">
                <button
                    onClick={() => setOpen(!open)}
                    className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center font-bold shadow-sm hover:scale-105 transition-transform text-sm overflow-hidden"
                >
                    <Avatar
                        userId={user?._id ?? ''}
                        version={user?.avatar ?? null}
                        fallback={initial}
                        className="h-full w-full object-cover"
                        fallbackClassName="h-full w-full"
                    />
                </button>

                {open && (
                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-zinc-900 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden flex flex-col z-50">
                        <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800">
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase font-bold">
                                Usuari
                            </p>
                            <p className="text-sm text-zinc-900 dark:text-zinc-100 truncate">
                                {email}
                            </p>
                        </div>

                        <div className="p-1">
                            <button
                                onClick={handleLogout}
                                className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md font-semibold transition-colors"
                            >
                                {t('header.logOff')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
