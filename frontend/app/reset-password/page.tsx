'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import TextField from '@/components/ui/TextField';

export default function ResetPasswordPage() {
    const { t } = useI18n();
    const searchParams = useSearchParams();
    const router = useRouter();

    const token = searchParams.get('token') || '';
    const urlEmail = searchParams.get('email') || '';

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [passwordErrors, setPasswordErrors] = useState<string[]>([]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setPasswordErrors([]);

        if (password !== confirmPassword) {
            setError(t('register.error.match'));
            return;
        }
        if (password.length < 8) {
            setError(t('error.IncorrectParameter.reason.TooShort'));
            return;
        }

        setLoading(true);

        try {
            const res = await apiClient.resetPassword({
                token,
                email: urlEmail,
                password,
            });

            if (res.error) {
                const details = res.details;
                if (res.error === 'IncorrectParameter' && details) {
                    if (details.incorrectParameter === 'email') {
                        setError(
                            t('error.IncorrectParameter.email') +
                                ' - ' +
                                t('error.IncorrectParameter.message')
                        );
                    } else if (details.incorrectParameter === 'password') {
                        const reasons = details.reasons || [];
                        setPasswordErrors(
                            reasons.map((reason: string) =>
                                t(`error.IncorrectParameter.reason.${reason}`)
                            )
                        );
                        setError(
                            t('error.IncorrectParameter.password') +
                                ' ' +
                                t('error.IncorrectParameter.message')
                        );
                    }
                } else if (res.error === 'InvalidResetToken') {
                    setError(t('error.InvalidResetToken'));
                } else if (res.error === 'ResetTokenExpired') {
                    setError(t('error.ResetTokenExpired'));
                } else {
                    setError(
                        t(`error.${res.error}`) ||
                            res.error ||
                            t('error.PostError')
                    );
                }
                return;
            }

            if (res.data && res.data.token) {
                apiClient.setSession(res.data.token, true);
                router.replace('/profile');
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(err);
            if (message.includes('MissingUppercase'))
                setError(t('error.IncorrectParameter.reason.MissingUppercase'));
            else if (message.includes('MissingLowercase'))
                setError(t('error.IncorrectParameter.reason.MissingLowercase'));
            else if (message.includes('MissingNumber'))
                setError(t('error.IncorrectParameter.reason.MissingNumber'));
            else if (message.includes('MissingSign'))
                setError(t('error.IncorrectParameter.reason.MissingSign'));
            else setError(message || t('error.PostError'));
        } finally {
            setLoading(false);
        }
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
                            {t('resetPassword.title')}
                        </h1>
                        <p className="mt-2 text-sm text-zinc-500">
                            {t('resetPassword.subtitle')}
                        </p>
                    </div>

                    {!token || !urlEmail ? (
                        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                            {t('resetPassword.invalidLink')}
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <TextField
                                label={t('register.email')}
                                type="email"
                                required
                                readOnly
                                value={urlEmail}
                            />

                            <TextField
                                label={t('resetPassword.password')}
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />

                            <TextField
                                label={t('resetPassword.confirm')}
                                type="password"
                                required
                                value={confirmPassword}
                                onChange={(e) =>
                                    setConfirmPassword(e.target.value)
                                }
                            />

                            {error && (
                                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                                    {error}
                                </div>
                            )}

                            {passwordErrors.length > 0 && (
                                <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                                    <ul className="list-disc pl-4 space-y-1">
                                        {passwordErrors.map((err, index) => (
                                            <li key={index}>{err}</li>
                                        ))}
                                    </ul>
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
                                    : t('resetPassword.submit')}
                            </Button>
                        </form>
                    )}
                </Card>
            </div>
        </div>
    );
}
