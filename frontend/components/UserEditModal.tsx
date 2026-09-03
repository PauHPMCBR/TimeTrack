'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import { useDirty } from '@/lib/useDirty';
import { User } from '@/types';
import type { UpdateUserRequest } from '@/schemas/api';
import { localeTag, toLocalDateKey } from '@/lib/datetime';
import Modal from '@/components/Modal';
import Button from '@/components/ui/Button';
import HoursMinutesInput from '@/components/ui/HoursMinutesInput';
import Label from '@/components/ui/Label';
import TextField from '@/components/ui/TextField';
import RoleSelector from '@/components/ui/RoleSelector';
import WeekDaysSelector from '@/components/ui/WeekDaysSelector';
import { EMPLOYEE_ROLE } from 'shared/src/lib/constants';
import {
    DEFAULT_EXPECTED_WORK_HOURS,
    DEFAULT_NON_WORKING_DAYS,
} from 'shared/src/lib/defaults';
import { COPIED_LINK_FEEDBACK_MS } from '@/lib/constants';
import { Check, Copy, Link2, Loader2 } from 'lucide-react';

type Props = {
    user: User | null;
    open: boolean;
    onClose: () => void;
    onSaved?: () => void;
};

/**
 * Reusable admin modal for editing a user's details. Shows the registration
 * (invite) link with a copy button for users that have not activated yet, so
 * the admin can resend it if it was lost.
 */
export default function UserEditModal({ user, open, onClose, onSaved }: Props) {
    const { t, lang } = useI18n();

    const [formData, setFormData] = useState<UpdateUserRequest>({
        name: '',
        email: '',
        role: EMPLOYEE_ROLE,
        dni: '',
        expectedWorkHours: DEFAULT_EXPECTED_WORK_HOURS,
        workDays: undefined,
        checkInRequired: true,
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [success, setSuccess] = useState(false);
    const [invalidatePassword, setInvalidatePassword] = useState(false);
    const [registrationLink, setRegistrationLink] = useState<string | null>(
        null
    );
    const [copied, setCopied] = useState(false);
    const [customNonWorkDays, setCustomNonWorkDays] = useState(false);
    const [nonWorkDays, setNonWorkDays] = useState<number[]>([]);
    const [startDate, setStartDate] = useState('');
    const { dirty, markDirty, resetDirty } = useDirty();

    const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

    useEffect(() => {
        if (!open || !user) return;
        setFormData({
            name: user.name,
            email: user.email,
            role: user.role,
            dni: user.dni ?? '',
            expectedWorkHours:
                user.expectedWorkHours ?? DEFAULT_EXPECTED_WORK_HOURS,
            workDays: user.workDays,
            checkInRequired: user.checkInRequired !== false,
        });
        const hasCustom = !!user.workDays && user.workDays.length > 0;
        setCustomNonWorkDays(hasCustom);
        setNonWorkDays(
            hasCustom
                ? ALL_DAYS.filter((d) => !user.workDays!.includes(d))
                : [...DEFAULT_NON_WORKING_DAYS]
        );
        setStartDate(
            user.trackingStartDate
                ? toLocalDateKey(user.trackingStartDate)
                : ''
        );
        resetDirty();
        setError(null);
        setValidationErrors([]);
        setSuccess(false);
        setInvalidatePassword(false);
        setCopied(false);
        setRegistrationLink(null);

        if (!user.registered) {
            apiClient.getUserRegistrationLink(user._id).then((res) => {
                if (!res.error && res.data?.registrationLink) {
                    setRegistrationLink(res.data.registrationLink);
                }
            });
        }
    }, [open, user]);

    const update = (partial: Partial<UpdateUserRequest>) => {
        setFormData((prev) => ({ ...prev, ...partial }));
        markDirty();
    };

    const toggleNonWorkDay = (jsDay: number) => {
        const next = nonWorkDays.includes(jsDay)
            ? nonWorkDays.filter((d) => d !== jsDay)
            : [...nonWorkDays, jsDay].sort((a, b) => a - b);
        setNonWorkDays(next);
        setFormData((prev) => ({
            ...prev,
            workDays: ALL_DAYS.filter((d) => !next.includes(d)),
        }));
        markDirty();
    };

    const handleCustomNonWorkDaysChange = (checked: boolean) => {
        setCustomNonWorkDays(checked);
        if (checked) {
            const start =
                nonWorkDays.length > 0
                    ? nonWorkDays
                    : [...DEFAULT_NON_WORKING_DAYS];
            setNonWorkDays(start);
            setFormData((prev) => ({
                ...prev,
                workDays: ALL_DAYS.filter((d) => !start.includes(d)),
            }));
        } else {
            setNonWorkDays([]);
            setFormData((prev) => ({ ...prev, workDays: undefined }));
        }
        markDirty();
    };

    const requestClose = () => {
        if (dirty && !window.confirm(t('common.unsavedChangesConfirm'))) return;
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setSaving(true);
        setError(null);
        setValidationErrors([]);
        setSuccess(false);

        const payload: UpdateUserRequest = { ...formData };
        // The tracking start date is non-nullable; always send the chosen day.
        if (startDate) {
            payload.trackingStartDate = startDate;
        }
        // When the admin invalidates the password, force a forgot-password
        // recovery (never let the admin set a known password).
        if (invalidatePassword) {
            payload.invalidatePassword = true;
        }

        const response = await apiClient.updateUser(user._id, payload);

        if (response.error) {
            if (response.error === 'IncorrectParameter') {
                if (response.details?.incorrectParameter === 'email') {
                    if (response.details?.reasons?.includes('AlreadyExists')) {
                        setError(
                            t('error.IncorrectParameter.reason.AlreadyExists')
                        );
                    } else {
                        setError(
                            t('error.IncorrectParameter.email') +
                                ' - ' +
                                t('error.IncorrectParameter.message')
                        );
                    }
                } else if (
                    response.details?.reasons?.includes('CannotDemoteAdmin')
                ) {
                    setError(
                        t('error.IncorrectParameter.reason.CannotDemoteAdmin')
                    );
                } else if (response.details?.incorrectParameter === 'password') {
                    const reasons = response.details?.reasons || [];
                    const reasonMsgs = reasons
                        .map((reason) =>
                            t(`error.IncorrectParameter.reason.${reason}`)
                        )
                        .filter(
                            (msg, i) =>
                                msg !==
                                `error.IncorrectParameter.reason.${reasons[i]}`
                        );
                    setError(
                        reasonMsgs.length > 0
                            ? reasonMsgs.join(', ')
                            : t('error.IncorrectParameter.message')
                    );
                } else {
                    setError(t('error.IncorrectParameter.message'));
                }
            } else if (response.error === 'ValidationError') {
                const errors = (response.details?.errors || []).map((e) =>
                    typeof e === 'string'
                        ? e
                        : e?.message || e?.code || JSON.stringify(e)
                );
                setValidationErrors(errors);
                setError(t('error.ValidationError'));
            } else if (response.error === 'PutError') {
                setError(t('error.PutError'));
            } else {
                setError(
                    t(`error.${response.error}`) ||
                        response.error ||
                        t('error.PutError')
                );
            }
            setSaving(false);
            return;
        }

        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
        resetDirty();
        onSaved?.();
        setSaving(false);
    };

    const copyLink = () => {
        if (!registrationLink) return;
        navigator.clipboard.writeText(registrationLink);
        setCopied(true);
        setTimeout(() => setCopied(false), COPIED_LINK_FEEDBACK_MS);
    };

    return (
        <Modal
            open={open}
            title={t('admin.usersEdit.title')}
            onClose={requestClose}
            footer={
                user && (
                    <Button
                        type="submit"
                        form="user-edit-form"
                        disabled={saving}
                        variant="primary"
                        className="w-full"
                    >
                        {saving ? t('common.saving') : t('common.save')}
                    </Button>
                )
            }
        >
            {!user ? (
                <div className="py-8 text-center text-sm text-zinc-500">
                    {t('profile.notFound')}
                </div>
            ) : (
                <form id="user-edit-form" onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                            {error}
                        </div>
                    )}

                    {validationErrors.length > 0 && (
                        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                            <ul className="list-disc pl-4 space-y-1">
                                {validationErrors.map((err, index) => (
                                    <li key={index}>{err}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {success && (
                        <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-600 dark:bg-green-900/20 dark:text-green-400">
                            <Check size={16} />
                            {t('admin.usersEdit.saved')}
                        </div>
                    )}

                    {!user.registered && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/30 dark:bg-amber-900/10">
                            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300">
                                <Link2 size={15} />
                                {t('admin.usersEdit.registrationLink')}
                            </div>
                            {registrationLink ? (
                                <>
                                    <div className="mb-2 break-all rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs text-zinc-700 dark:border-amber-700 dark:bg-zinc-900 dark:text-zinc-300">
                                        {registrationLink}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={copyLink}
                                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 transition-colors"
                                    >
                                        {copied ? (
                                            <Check size={14} />
                                        ) : (
                                            <Copy size={14} />
                                        )}
                                        {copied
                                            ? t('admin.copied')
                                            : t('admin.copy')}
                                    </button>
                                </>
                            ) : (
                                <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                                    <Loader2
                                        size={14}
                                        className="animate-spin"
                                    />
                                    {t('common.loading')}
                                </div>
                            )}
                        </div>
                    )}

                    <TextField
                        label={t('admin.form.name')}
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => update({ name: e.target.value })}
                    />

                    <TextField
                        label={t('admin.form.email')}
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => update({ email: e.target.value })}
                    />

                    <TextField
                        label={t('admin.form.dni')}
                        type="text"
                        required
                        value={formData.dni ?? ''}
                        onChange={(e) => update({ dni: e.target.value })}
                    />

                    <div>
                        <Label>{t('admin.usersEdit.passwordLabel')}</Label>
                        <p className="mb-2 text-sm text-zinc-500 dark:text-zinc-400">
                            {t('admin.usersEdit.invalidatePasswordDesc')}
                        </p>
                        <Button
                            type="button"
                            variant={invalidatePassword ? 'primary' : 'soft'}
                            onClick={() => setInvalidatePassword((v) => !v)}
                            className="w-full"
                        >
                            {invalidatePassword
                                ? t('admin.usersEdit.invalidatePasswordOn')
                                : t('admin.usersEdit.invalidatePassword')}
                        </Button>
                    </div>

                    <div>
                        <Label>{t('admin.form.expectedHours')}</Label>
                        <HoursMinutesInput
                            value={formData.expectedWorkHours ?? DEFAULT_EXPECTED_WORK_HOURS}
                            minHours={1}
                            onChange={(v) => update({ expectedWorkHours: v })}
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 flex cursor-pointer items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            <input
                                type="checkbox"
                                checked={customNonWorkDays}
                                onChange={(e) =>
                                    handleCustomNonWorkDaysChange(
                                        e.target.checked
                                    )
                                }
                                className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            {t('admin.form.customNonWorkDays')}
                        </label>

                        {customNonWorkDays && (
                            <WeekDaysSelector
                                className="mt-2"
                                selected={nonWorkDays}
                                onToggle={toggleNonWorkDay}
                                locale={localeTag(lang)}
                            />
                        )}
                    </div>

                    <div>
                        <label className="mb-1.5 flex cursor-pointer items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            <input
                                type="checkbox"
                                checked={formData.checkInRequired !== false}
                                onChange={(e) =>
                                    update({ checkInRequired: e.target.checked })
                                }
                                className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            {t('admin.form.checkInRequired')}
                        </label>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            {t('admin.form.checkInRequiredHelp')}
                        </p>
                    </div>

                    <div>
                        <Label>{t('admin.form.trackingStartDate')}</Label>
                        <input
                            type="date"
                            value={startDate}
                            max={toLocalDateKey(new Date())}
                            required
                            onChange={(e) => {
                                setStartDate(e.target.value);
                                markDirty();
                            }}
                            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                        />
                    </div>

                    <div>
                        <Label className="mb-2">
                            {t('admin.form.role.label')}
                        </Label>
                        <RoleSelector
                            value={formData.role ?? EMPLOYEE_ROLE}
                            onChange={(role) => update({ role })}
                        />
                    </div>
                </form>
            )}
        </Modal>
    );
}
