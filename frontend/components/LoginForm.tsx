'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useI18n } from '@/app/i18n';
import { APP_NAME, APP_ICON_URL } from '@/lib/brand';
import { apiClient } from '@/lib/api';
import { Alert } from './ui/Alert';
import { LoginRequestSchema } from '@/schemas/api';
import { REMEMBERED_EMAIL_KEY } from '@/lib/storage';
import { Clock } from 'lucide-react';
import Button from './ui/Button';
import PasswordField from './ui/PasswordField';

export default function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { t } = useI18n();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [remember, setRemember] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            LoginRequestSchema.parse({ email, password });

            const res = await apiClient.login({ email, password });
            if (res.error) throw new Error(res.error);

            if (res.data) {
                // Keep the token in memory so the session works even when the
                // "remember me" box is unchecked; only persist it otherwise.
                apiClient.setSession(res.data.token, remember);
                if (remember) {
                    localStorage.setItem(
                        REMEMBERED_EMAIL_KEY,
                        res.data.user.email
                    );
                } else {
                    localStorage.removeItem(REMEMBERED_EMAIL_KEY);
                }
                // Preserve the `next` return-to (set by RequireAuth) so a
                // user who hit a protected page while logged out lands back
                // there after logging in.
                const next = searchParams.get('next');
                router.push(next && next.startsWith('/') ? next : '/dashboard');
            } else {
                throw new Error('UnknownError');
            }
        } catch (err) {
            const error = err as Error & { errors?: { message?: string }[] };
            if (error.errors && error.errors.length > 0) {
                setError(error.errors[0].message ?? t('error.NetworkError'));
            } else {
                const message = error.message || t('error.NetworkError');
                const translationKey = `error.${message}`;
                const translated = t(translationKey);
                setError(translated !== translationKey ? translated : message);
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <form
            onSubmit={onSubmit}
            className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
            <div className="mb-6 flex flex-col items-center">
                {APP_ICON_URL ? (
                    <img
                        src={APP_ICON_URL}
                        alt={APP_NAME}
                        className="mb-2 h-12 w-auto object-contain"
                    />
                ) : (
                    <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white">
                        <Clock size={20} />
                    </div>
                )}
                <div className="text-2xl font-bold">{APP_NAME}</div>
                <div className="text-xs text-zinc-500">
                    {t('brand.tagline')}
                </div>
            </div>

            <h1 className="mb-4 text-center text-xl font-semibold">
                {t('login.title')}
            </h1>

            <div className="space-y-3">
                <input
                    type="email"
                    className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700"
                    placeholder={t('login.email.placeholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />

                <PasswordField
                    placeholder={t('login.password.placeholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />

                <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                    <input
                        type="checkbox"
                        className="accent-indigo-600"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                    />
                    {t('login.remember')}
                </label>

                {error && (
                    <Alert variant="destructive" className="py-2">
                        {error}
                    </Alert>
                )}

                <Button
                    type="submit"
                    disabled={loading}
                    className="w-full"
                    size="lg"
                >
                    {loading ? t('common.loading') : t('login.submit')}
                </Button>

                <div className="text-center text-sm">
                    <Link
                        href="/forgot-password"
                        className="text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                        {t('login.forgot')}
                    </Link>
                </div>
            </div>
        </form>
    );
}
