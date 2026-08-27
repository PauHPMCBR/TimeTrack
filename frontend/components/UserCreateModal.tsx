'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import { useDirty } from '@/lib/useDirty';
import type { CreateUserRequest } from '@/schemas/api';
import Modal from '@/components/Modal';
import Button from '@/components/ui/Button';
import Label from '@/components/ui/Label';
import TextField from '@/components/ui/TextField';
import RoleSelector from '@/components/ui/RoleSelector';
import { Check, Copy, Loader2 } from 'lucide-react';

type Props = {
    open: boolean;
    onClose: () => void;
    onCreated?: () => void;
};

/**
 * Reusable admin modal to create a new user. On success it shows the
 * registration (invite) link so the admin can copy and share it; closing the
 * popup returns to the users list (no separate redirect).
 */
export default function UserCreateModal({ open, onClose, onCreated }: Props) {
    const { t } = useI18n();

    const [formData, setFormData] = useState<CreateUserRequest>({
        name: '',
        email: '',
        role: 'employee',
        dni: '',
    });
    const [loading, setLoading] = useState(false);
    const [inviteLink, setInviteLink] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const { dirty, markDirty, resetDirty } = useDirty();

    useEffect(() => {
        if (open) {
            setFormData({ name: '', email: '', role: 'employee', dni: '' });
            setInviteLink(null);
            setCopied(false);
            setError(null);
            setValidationErrors([]);
            resetDirty();
        }
    }, [open]);

    const update = (partial: Partial<CreateUserRequest>) => {
        setFormData((prev) => ({ ...prev, ...partial }));
        markDirty();
    };

    const requestClose = () => {
        if (dirty && !window.confirm(t('common.unsavedChangesConfirm'))) return;
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setValidationErrors([]);
        setInviteLink(null);

        try {
            const response = await apiClient.createUser(formData);

            if (response.error) {
                if (response.error === 'IncorrectParameter') {
                    if (response.details.incorrectParameter === 'email') {
                        if (
                            response.details.reasons?.includes('AlreadyExists')
                        ) {
                            setError(
                                t(
                                    'error.IncorrectParameter.reason.AlreadyExists'
                                )
                            );
                        } else {
                            setError(
                                t('error.IncorrectParameter.email') +
                                    ' - ' +
                                    t('error.IncorrectParameter.message')
                            );
                        }
                    } else {
                        setError(t('error.IncorrectParameter.message'));
                    }
                } else if (response.error === 'MissingParameter') {
                    if (response.details.missingParameter === 'email') {
                        setError(
                            t('error.MissingParameter') +
                                ': ' +
                                t('error.IncorrectParameter.email')
                        );
                    } else if (response.details.missingParameter === 'name') {
                        setError(
                            t('error.MissingParameter') +
                                ': ' +
                                t('register.name')
                        );
                    }
                } else if (response.error === 'ValidationError') {
                    const errors = (response.details.errors || []).map(
                        (e: any) =>
                            typeof e === 'string'
                                ? e
                                : e?.message || e?.code || JSON.stringify(e)
                    );
                    if (errors.length > 0) {
                        setValidationErrors(errors);
                        setError(t('error.ValidationError'));
                    } else if (response.details.message) {
                        setError(response.details.message);
                    } else {
                        setError(t('error.ValidationError'));
                    }
                } else if (response.error === 'PostError') {
                    setError(t('error.PostError'));
                } else {
                    setError(
                        t(`error.${response.error}`) ||
                            response.error ||
                            t('error.PostError')
                    );
                }
                setLoading(false);
                return;
            }

            if (response.data?.registrationLink) {
                setInviteLink(response.data.registrationLink);
                resetDirty();
                onCreated?.();
            } else {
                setError('User created, but no invitation link was received.');
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || t('error.PostError'));
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        if (inviteLink) {
            navigator.clipboard.writeText(inviteLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <Modal
            open={open}
            title={t('admin.create.title')}
            onClose={requestClose}
        >
            {inviteLink ? (
                <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center dark:border-green-900/30 dark:bg-green-900/10">
                    <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/20">
                        <Check size={24} />
                    </div>

                    <h3 className="text-lg font-medium text-green-900 dark:text-green-300">
                        {t('admin.success.title')}
                    </h3>
                    <p className="mb-6 mt-1 text-sm text-green-800/80 dark:text-green-200/70">
                        {t('admin.success.desc')}
                    </p>

                    <div className="mb-4">
                        <input
                            readOnly
                            value={inviteLink}
                            className="w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-sm text-zinc-600 outline-none focus:ring-2 focus:ring-green-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                        />
                    </div>

                    <button
                        onClick={copyToClipboard}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700"
                    >
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                        {copied ? t('admin.copied') : t('admin.copy')}
                    </button>

                    <button
                        onClick={onClose}
                        className="mt-3 w-full rounded-lg border border-green-300 px-4 py-2 text-sm font-medium text-green-700 transition-colors hover:bg-green-100 dark:border-green-700 dark:text-green-300 dark:hover:bg-green-900/30"
                    >
                        {t('common.close')}
                    </button>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                            {error}
                        </div>
                    )}

                    {validationErrors.length > 0 && (
                        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                            <ul className="list-disc space-y-1 pl-4">
                                {validationErrors.map((err, index) => (
                                    <li key={index}>{err}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <TextField
                        label={t('admin.form.name')}
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => update({ name: e.target.value })}
                        placeholder={t('register.name')}
                    />

                    <TextField
                        label={t('admin.form.email')}
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => update({ email: e.target.value })}
                        placeholder={t('login.email.placeholder')}
                    />

                    <TextField
                        label={t('admin.form.dni')}
                        type="text"
                        required
                        value={formData.dni ?? ''}
                        onChange={(e) => update({ dni: e.target.value })}
                        placeholder={t('admin.form.dniPlaceholder')}
                    />

                    <div>
                        <Label className="mb-2">
                            {t('admin.form.role.label')}
                        </Label>
                        <RoleSelector
                            value={formData.role}
                            onChange={(role) => update({ role })}
                        />
                    </div>

                    <Button
                        type="submit"
                        disabled={loading}
                        variant="primary"
                        className="w-full"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <Loader2 size={16} className="animate-spin" />
                                {t('common.loading')}
                            </span>
                        ) : (
                            t('admin.btn.create')
                        )}
                    </Button>
                </form>
            )}
        </Modal>
    );
}
