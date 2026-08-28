'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import LanguageSwitcher from '../../../components/LanguageSwitcher';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import TextField from '@/components/ui/TextField';

export default function CompleteRegistrationPage() {
    const { t } = useI18n();
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();

    const token = params.token as string;

    const urlEmail = searchParams.get('email') || '';
    const urlName = searchParams.get('name') || '';

    const [formData, setFormData] = useState({
        email: urlEmail,
        name: urlName,
        password: '',
        confirmPassword: '',
    });

    useEffect(() => {
        if (urlEmail || urlName) {
            setFormData((prev) => ({
                ...prev,
                email: urlEmail,
                name: urlName,
            }));
        }
    }, [urlEmail, urlName]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [passwordErrors, setPasswordErrors] = useState<string[]>([]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setPasswordErrors([]);

        if (formData.password !== formData.confirmPassword) {
            setError(t('register.error.match'));
            return;
        }
        if (formData.password.length < 8) {
            setError(t('error.IncorrectParameter.reason.TooShort'));
            return;
        }

        setLoading(true);

        try {
            const res = await apiClient.register({
                registrationToken: token,
                email: formData.email,
                name: formData.name,
                password: formData.password,
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
                        const errorMessages = reasons.map((reason: string) =>
                            t(`error.IncorrectParameter.reason.${reason}`)
                        );
                        setPasswordErrors(errorMessages);
                        setError(
                            t('error.IncorrectParameter.password') +
                                ' ' +
                                t('error.IncorrectParameter.message')
                        );
                    }
                } else if (res.error === 'InvalidRegisterToken') {
                    setError(t('error.InvalidRegisterToken'));
                } else if (res.error === 'MissingParameter') {
                    if (details?.missingParameter === 'password') {
                        setError(
                            t('error.MissingParameter') +
                                ': ' +
                                t('error.IncorrectParameter.password')
                        );
                    }
                } else if (res.error === 'PostError') {
                    setError(t('error.PostError'));
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
            } else {
                router.push('/');
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
            else if (message.includes('email'))
                setError(
                    t('error.IncorrectParameter.email') +
                        ' - ' +
                        t('error.IncorrectParameter.message')
                );
            else setError(message || t('error.PostError'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
            {/* HEADER WITH LANGUAGE SWITCHER (LEFT) */}
            <header className="flex w-full justify-start px-6 py-4">
                <LanguageSwitcher />
            </header>

            {/* MAIN CONTENT */}
            <div className="flex flex-1 items-center justify-center px-4 pb-20">
                <Card className="w-full max-w-md p-8">
                    <div className="mb-6 text-center">
                        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                            {t('register.welcome')}
                        </h1>
                        <p className="mt-2 text-sm text-zinc-500">
                            {t('register.subtitle')}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <TextField
                            label={t('register.name')}
                            type="text"
                            required
                            readOnly
                            value={formData.name}
                        />

                        <TextField
                            label={t('register.email')}
                            type="email"
                            required
                            readOnly
                            value={formData.email}
                        />

                        <TextField
                            label={t('register.password')}
                            type="password"
                            required
                            value={formData.password}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    password: e.target.value,
                                })
                            }
                        />

                        <TextField
                            label={t('register.confirm')}
                            type="password"
                            required
                            value={formData.confirmPassword}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    confirmPassword: e.target.value,
                                })
                            }
                        />

                        {error && (
                            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                                {error}
                            </div>
                        )}

                        {/* Password-specific errors */}
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
                            {loading ? t('register.saving') : t('register.btn')}
                        </Button>
                    </form>
                </Card>
            </div>
        </div>
    );
}
