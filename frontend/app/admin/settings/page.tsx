'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import { useUnsavedChanges } from '@/lib/useUnsavedChanges';
import { useDirty } from '@/lib/useDirty';
import { localeTag } from '@/lib/datetime';
import Button from '@/components/ui/Button';
import HoursMinutesInput from '@/components/ui/HoursMinutesInput';
import Label from '@/components/ui/Label';
import WeekDaysSelector from '@/components/ui/WeekDaysSelector';
import Card from '@/components/ui/Card';
import AdminBackButton from '../../../components/AdminBackButton';
import { Check } from 'lucide-react';

type FormState = {
    defaultExpectedHours: number;
    toleranceHours: number;
    endOfDayHour: number;
    nonWorkingDays: number[];
};

export default function AdminSettingsPage() {
    const { t, lang } = useI18n();

    const [formData, setFormData] = useState<FormState>({
        defaultExpectedHours: 8,
        toleranceHours: 1,
        endOfDayHour: 20,
        nonWorkingDays: [6, 0],
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [success, setSuccess] = useState(false);
    const { dirty, markDirty, resetDirty } = useDirty();

    useUnsavedChanges(dirty);

    const updateForm = (partial: Partial<FormState>) => {
        setFormData((prev) => ({ ...prev, ...partial }));
        markDirty();
    };

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                setLoading(true);
                const res = await apiClient.getSettings();
                if (res.error) {
                    setError(
                        t(`error.${res.error}`) ||
                            res.error ||
                            t('error.GetError')
                    );
                } else if (res.data?.settings) {
                    const s = res.data.settings;
                    setFormData({
                        defaultExpectedHours: s.defaultExpectedHours,
                        toleranceHours:
                            s.toleranceHours ?? s.benevolenceHours ?? 1,
                        endOfDayHour: s.endOfDayHour,
                        nonWorkingDays: s.nonWorkingDays ?? [6, 0],
                    });
                }
            } catch (err) {
                console.error('Error carregant configuració:', err);
                setError(t('error.GetError'));
            } finally {
                resetDirty();
                setLoading(false);
            }
        };
        fetchSettings();
    }, [t]);

    const toggleDay = (jsDay: number) => {
        updateForm({
            nonWorkingDays: formData.nonWorkingDays.includes(jsDay)
                ? formData.nonWorkingDays.filter((d) => d !== jsDay)
                : [...formData.nonWorkingDays, jsDay].sort((a, b) => a - b),
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        setValidationErrors([]);
        setSuccess(false);

        try {
            const response = await apiClient.updateSettings({
                defaultExpectedHours: formData.defaultExpectedHours,
                toleranceHours: formData.toleranceHours,
                endOfDayHour: formData.endOfDayHour,
                nonWorkingDays: formData.nonWorkingDays,
            });

            if (response.error) {
                if (response.error === 'ValidationError') {
                    const errors = (response.details.errors || []).map(
                        (e: any) =>
                            typeof e === 'string'
                                ? e
                                : e?.message || e?.code || JSON.stringify(e)
                    );
                    if (errors.length > 0) setValidationErrors(errors);
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
            resetDirty();
            setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
            console.error(err);
            setError(err.message || t('error.PutError'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <AdminBackButton />

            <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                    {t('admin.settings.title')}
                </h1>
                <p className="mt-1 text-sm text-zinc-500">
                    {t('admin.settings.subtitle')}
                </p>
            </div>

            {loading ? (
                <div className="p-10 text-center animate-pulse text-zinc-500">
                    {t('common.loading')}
                </div>
            ) : (
                <Card className="p-6">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                                {error}
                            </div>
                        )}

                        {validationErrors.length > 0 && (
                            <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                                <ul className="list-disc pl-4 space-y-1">
                                    {validationErrors.map((err, index) => (
                                        <li key={index}>{err}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {success && (
                            <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-600 dark:bg-green-900/20 dark:text-green-400">
                                <Check size={16} />
                                {t('admin.settings.saved')}
                            </div>
                        )}

                        <div className="space-y-6">
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                    {t('admin.settings.defaultHoursLabel')}
                                </label>
                                <HoursMinutesInput
                                    value={formData.defaultExpectedHours}
                                    minHours={0.5}
                                    onChange={(v) =>
                                        updateForm({ defaultExpectedHours: v })
                                    }
                                />
                                <p className="mt-1.5 text-xs text-zinc-500">
                                    {t('admin.settings.defaultHoursHelp')}
                                </p>
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                    {t('admin.settings.toleranceLabel')}
                                </label>
                                <HoursMinutesInput
                                    value={formData.toleranceHours}
                                    minHours={0}
                                    onChange={(v) =>
                                        updateForm({ toleranceHours: v })
                                    }
                                />
                                <p className="mt-1.5 text-xs text-zinc-500">
                                    {t('admin.settings.toleranceHelp')}
                                </p>
                            </div>

                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                    {t('admin.settings.endOfDayLabel')}
                                </label>
                                <HoursMinutesInput
                                    value={formData.endOfDayHour}
                                    minHours={0}
                                    onChange={(v) =>
                                        updateForm({
                                            endOfDayHour: Math.min(24, v),
                                        })
                                    }
                                />
                                <p className="mt-1.5 text-xs text-zinc-500">
                                    {t('admin.settings.endOfDayHelp')}
                                </p>
                            </div>

                            <div>
                                <Label className="mb-2">
                                    {t('admin.settings.nonWorkingDaysLabel')}
                                </Label>
                                <WeekDaysSelector
                                    selected={formData.nonWorkingDays}
                                    onToggle={toggleDay}
                                    locale={localeTag(lang)}
                                />
                                <p className="mt-1.5 text-xs text-zinc-500">
                                    {t('admin.settings.nonWorkingDaysHelp')}
                                </p>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            disabled={saving}
                            variant="primary"
                            className="mt-8 w-full"
                        >
                            {saving ? t('common.saving') : t('common.save')}
                        </Button>
                    </form>
                </Card>
            )}
        </div>
    );
}
