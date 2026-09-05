'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import { User } from '@/types';
import Avatar from '@/components/Avatar';
import { ChevronLeft, Mail } from 'lucide-react';

export default function OtherUserProfilePage() {
    const { t } = useI18n();
    const params = useParams();
    const router = useRouter();
    const userId = params?.userId as string;

    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) return;

        const loadUser = async () => {
            setLoading(true);
            try {
                const res = await apiClient.getProfile(userId);
                if (res.data) {
                    setUser(res.data.user || res.data);
                }
            } catch (error) {
                console.error('Error loading profile:', error);
            } finally {
                setLoading(false);
            }
        };

        loadUser();
    }, [userId]);

    if (loading)
        return (
            <div className="p-10 text-center text-zinc-500 animate-pulse">
                {t('common.loading')}
            </div>
        );
    if (!user)
        return (
            <div className="p-10 text-center text-red-500">
                {t('profile.notFound')}
            </div>
        );

    const displayName = user.name || t('common.noName');
    const initials = (displayName[0] || 'U').toUpperCase();

    return (
        <section className="space-y-6 pb-20">
            <div className="flex items-center gap-2">
                <button
                    onClick={() => router.back()}
                    className="rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                    <ChevronLeft size={24} />
                </button>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                    {t('profile.title')}
                </h1>
            </div>

            <div className="flex items-center gap-4">
                <Avatar
                    userId={user._id}
                    version={user.avatar ?? null}
                    alt={displayName}
                    fallback={initials}
                    className="h-16 w-16 rounded-full object-cover shadow-lg"
                    fallbackClassName="h-16 w-16 rounded-full bg-indigo-600 text-white text-2xl shadow-lg"
                />
                <div>
                    <div className="text-lg font-semibold text-zinc-900 dark:text-white">
                        {displayName}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-zinc-500">
                        <Mail size={14} />
                        {user.email}
                    </div>
                    <div className="mt-1 inline-block rounded-md border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                        {user.role || 'Employee'}
                    </div>
                </div>
            </div>
        </section>
    );
}
