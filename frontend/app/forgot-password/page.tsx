'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import TextField from '@/components/ui/TextField';

export default function ForgotPasswordPage() {
    const { t } = useI18n();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const res = await apiClient.forgotPassword(email);

        // Deliberately show the same message whether or not the account exists
        // (avoids leaking which emails are registered).
        if (res.error === 'NetworkError') {
            setError(t('error.NetworkError'));
            setLoading(false);
            return;
        }
        setSent(true);
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
            <header className="flex w-full justify-start px-6 py-4">
                <LanguageSwitcher />
            </header>

            <div className="flex flex-1 items-center justify-center px-4 pb-20">
                <Card className="w-full max-w-md p-8">
                    <div className="mb-6 text-center">
                        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                            {t('forgotPassword.title')}
                        </h1>
                        <p className="mt-2 text-sm text-zinc-500">
                            {t('forgotPassword.subtitle')}
                        </p>
                    </div>

                    {sent ? (
                        <div className="rounded-lg bg-green-50 p-4 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
                            {t('forgotPassword.sent')}
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <TextField
                                label={t('forgotPassword.email')}
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />

                            {error && (
                                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                                    {error}
                                </div>
                            )}

                            <Button
                                type="submit"
                                disabled={loading}
                                variant="primary"
                                className="w-full"
                            >
                                {loading
                                    ? t('common.loading')
                                    : t('forgotPassword.submit')}
                            </Button>
                        </form>
                    )}

                    <div className="mt-6 text-center text-sm">
                        <Link
                            href="/"
                            className="text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                            {t('forgotPassword.backLogin')}
                        </Link>
                    </div>
                </Card>
            </div>
        </div>
    );
}