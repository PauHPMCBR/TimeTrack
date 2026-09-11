'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import { useUnsavedChanges } from '@/lib/useUnsavedChanges';
import { useDirty } from '@/lib/useDirty';
import { localeTag } from '@/lib/datetime';
import { initConfiguredTimezone } from '@/lib/timezone';
import { normalizeWeekTimetable } from '@/lib/timetable';
import Button from '@/components/ui/Button';
import WeeklyHoursEditor from '@/components/weeklyHours/WeeklyHoursEditor';
import HoursMinutesInput from '@/components/ui/HoursMinutesInput';
import Card from '@/components/ui/Card';
import LoadingState from '@/components/ui/LoadingState';
import ExpectedTimetableField from '@/components/timetable/ExpectedTimetableField';
import OptionPicker from '@/components/ui/OptionPicker';
import AdminBackButton from '../../../components/AdminBackButton';
import {
    defaultWeeklyExpectedHours,
    DEFAULT_END_OF_DAY_HOUR,
    DEFAULT_MONTHLY_APPROVAL_REMINDER_DAYS,
    DEFAULT_TIMETABLE_TOLERANCE_MINUTES,
    DEFAULT_TOLERANCE_MINUTES,
    DEFAULT_TIMEZONE,
} from 'shared/src/lib/defaults';
import {
    defaultTimetable,
    InconsistencyReminderMode,
    InconsistencyReminderModeSchema,
    ScheduleMode,
    WeekTimetable,
} from 'shared/src/schemas/database';
import { Check } from 'lucide-react';

type FormState = {
    defaultWeeklyExpectedHours: number[];
    toleranceMinutes: number;
    defaultScheduleMode: ScheduleMode;
    defaultTimetable: WeekTimetable;
    timetableToleranceMinutes: number;
    endOfDayHour: number;
    inconsistencyReminderMode: InconsistencyReminderMode;
    monthlyApprovalReminderDays: number;
    timezone: string;
    privacyNoticeText: string;
    workerConsultationAcknowledged: boolean;
};

const INCONSISTENCY_MODES: InconsistencyReminderMode[] = [
    'disabled',
    'user_choice',
    'forced',
];

const COMMON_TIMEZONES = [
    DEFAULT_TIMEZONE,
    'Europe/Lisbon',
    'Europe/Paris',
    'Europe/Berlin',
    'Europe/Rome',
    'America/New_York',
    'America/Chicago',
    'America/Mexico_City',
    'America/Sao_Paulo',
    'Asia/Dubai',
    'Asia/Kolkata',
    'Asia/Shanghai',
    'Asia/Tokyo',
];

export default function AdminSettingsPage() {
    const { t, lang } = useI18n();

    const [formData, setFormData] = useState<FormState>({
        defaultWeeklyExpectedHours: defaultWeeklyExpectedHours(),
        toleranceMinutes: DEFAULT_TOLERANCE_MINUTES,
        defaultScheduleMode: 'hours',
        defaultTimetable: defaultTimetable(),
        timetableToleranceMinutes: DEFAULT_TIMETABLE_TOLERANCE_MINUTES,
        endOfDayHour: DEFAULT_END_OF_DAY_HOUR,
        inconsistencyReminderMode: 'forced',
        monthlyApprovalReminderDays: DEFAULT_MONTHLY_APPROVAL_REMINDER_DAYS,
        timezone: DEFAULT_TIMEZONE,
        privacyNoticeText: '',
        workerConsultationAcknowledged: false,
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
                        defaultWeeklyExpectedHours: Array.isArray(
                            s.defaultWeeklyExpectedHours
                        )
                            ? s.defaultWeeklyExpectedHours.map((h) =>
                                  typeof h === 'number' && h > 0 ? h : 0
                              )
                            : defaultWeeklyExpectedHours(),
                        toleranceMinutes:
                            s.toleranceMinutes ?? DEFAULT_TOLERANCE_MINUTES,
                        defaultScheduleMode: s.defaultScheduleMode ?? 'hours',
                        defaultTimetable: normalizeWeekTimetable(
                            s.defaultTimetable
                        ),
                        timetableToleranceMinutes:
                            s.timetableToleranceMinutes ??
                            DEFAULT_TIMETABLE_TOLERANCE_MINUTES,
                        endOfDayHour: s.endOfDayHour,
                        inconsistencyReminderMode:
                            InconsistencyReminderModeSchema.catch(
                                'forced'
                            ).parse(s.inconsistencyReminderMode),
                        monthlyApprovalReminderDays:
                            s.monthlyApprovalReminderDays ??
                            DEFAULT_MONTHLY_APPROVAL_REMINDER_DAYS,
                        timezone: s.timezone || DEFAULT_TIMEZONE,
                        privacyNoticeText: s.privacyNoticeText ?? '',
                        workerConsultationAcknowledged:
                            s.workerConsultationAcknowledged ?? false,
                    });
                    initConfiguredTimezone(s.timezone || DEFAULT_TIMEZONE);
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        setValidationErrors([]);
        setSuccess(false);

        try {
            const response = await apiClient.updateSettings({
                defaultWeeklyExpectedHours: formData.defaultWeeklyExpectedHours,
                toleranceMinutes: formData.toleranceMinutes,
                defaultScheduleMode: formData.defaultScheduleMode,
                defaultTimetable: formData.defaultTimetable,
                timetableToleranceMinutes: formData.timetableToleranceMinutes,
                endOfDayHour: formData.endOfDayHour,
                inconsistencyReminderMode: formData.inconsistencyReminderMode,
                monthlyApprovalReminderDays:
                    formData.monthlyApprovalReminderDays,
                timezone: formData.timezone,
                privacyNoticeText: formData.privacyNoticeText,
                workerConsultationAcknowledged:
                    formData.workerConsultationAcknowledged,
            });

            if (response.error) {
                if (response.error === 'ValidationError') {
                    const errors = (response.details?.errors || []).map((e) =>
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
            initConfiguredTimezone(formData.timezone);
            resetDirty();
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : t('error.PutError'));
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
                <LoadingState />
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
                            <div className="flex flex-col items-start gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
                                <label className="mb-1.5 block text-l font-medium text-zinc-900 dark:text-zinc-100">
                                    {t('admin.settings.userDefaults')}
                                </label>

                                <div className="w-full">
                                    <label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                        {t(
                                            'admin.settings.defaultScheduleModeLabel'
                                        )}
                                    </label>
                                    <OptionPicker<ScheduleMode>
                                        options={[
                                            {
                                                value: 'hours',
                                                label: t(
                                                    'admin.settings.scheduleModeHours'
                                                ),
                                            },
                                            {
                                                value: 'timetable',
                                                label: t(
                                                    'admin.settings.scheduleModeTimetable'
                                                ),
                                            },
                                        ]}
                                        value={formData.defaultScheduleMode}
                                        onChange={(mode) =>
                                            updateForm({
                                                defaultScheduleMode: mode,
                                            })
                                        }
                                    />
                                    <p className="mt-1.5 text-xs text-zinc-500">
                                        {t(
                                            'admin.settings.defaultScheduleModeHelp'
                                        )}
                                    </p>
                                </div>

                                <div className="w-full">
                                    <label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                        {t(
                                            'admin.settings.defaultWeeklyHoursLabel'
                                        )}
                                    </label>
                                    <p className="mb-2 text-xs text-zinc-500">
                                        {t(
                                            'admin.settings.defaultWeeklyHoursHelp'
                                        )}
                                    </p>
                                    <WeeklyHoursEditor
                                        hours={
                                            formData.defaultWeeklyExpectedHours
                                        }
                                        locale={localeTag(lang)}
                                        onChange={(next) =>
                                            updateForm({
                                                defaultWeeklyExpectedHours:
                                                    next,
                                            })
                                        }
                                    />
                                </div>

                                <ExpectedTimetableField
                                    timetable={formData.defaultTimetable}
                                    locale={localeTag(lang)}
                                    label={t(
                                        'admin.settings.defaultTimetableLabel'
                                    )}
                                    help={t(
                                        'admin.settings.defaultTimetableHelp'
                                    )}
                                    onChange={(next) =>
                                        updateForm({
                                            defaultTimetable: next,
                                        })
                                    }
                                />
                            </div>

                            <div className="flex flex-col items-start gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
                                <div className="w-full space-y-4">
                                    <div>
                                        <label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                            {t('admin.settings.toleranceLabel')}
                                        </label>
                                        <input
                                            type="number"
                                            min={0}
                                            step={5}
                                            value={formData.toleranceMinutes}
                                            onChange={(e) =>
                                                updateForm({
                                                    toleranceMinutes: Number(
                                                        e.target.value
                                                    ),
                                                })
                                            }
                                            className="w-28 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                                        />
                                        <p className="mt-1.5 text-xs text-zinc-500">
                                            {t('admin.settings.toleranceHelp')}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                            {t(
                                                'admin.settings.timetableToleranceLabel'
                                            )}
                                        </label>
                                        <input
                                            type="number"
                                            min={0}
                                            step={1}
                                            value={
                                                formData.timetableToleranceMinutes
                                            }
                                            onChange={(e) =>
                                                updateForm({
                                                    timetableToleranceMinutes:
                                                        Number(e.target.value),
                                                })
                                            }
                                            className="w-28 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                                        />
                                        <p className="mt-1.5 text-xs text-zinc-500">
                                            {t(
                                                'admin.settings.timetableToleranceHelp'
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col items-start gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
                                <label className="mb-1.5 block text-l font-medium text-zinc-900 dark:text-zinc-100">
                                    {t('admin.settings.notificationsSection')}
                                </label>
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
                                    <label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                        {t(
                                            'admin.settings.approvalReminderDaysLabel'
                                        )}
                                    </label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={60}
                                        value={
                                            formData.monthlyApprovalReminderDays
                                        }
                                        onChange={(e) =>
                                            updateForm({
                                                monthlyApprovalReminderDays:
                                                    Number(e.target.value),
                                            })
                                        }
                                        className="w-28 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                                    />
                                    <p className="mt-1.5 text-xs text-zinc-500">
                                        {t(
                                            'admin.settings.approvalReminderDaysHelp'
                                        )}
                                    </p>
                                </div>

                                <div className="w-full">
                                    <label
                                        htmlFor="inconsistency-reminder-mode"
                                        className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100"
                                    >
                                        {t('admin.settings.reminderLabel')}
                                    </label>
                                    <select
                                        id="inconsistency-reminder-mode"
                                        value={
                                            formData.inconsistencyReminderMode
                                        }
                                        onChange={(e) =>
                                            updateForm({
                                                inconsistencyReminderMode:
                                                    InconsistencyReminderModeSchema.catch(
                                                        'forced'
                                                    ).parse(e.target.value),
                                            })
                                        }
                                        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                                    >
                                        {INCONSISTENCY_MODES.map((mode) => (
                                            <option key={mode} value={mode}>
                                                {t(
                                                    `admin.settings.reminderMode.${mode}`
                                                )}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="mt-1 text-xs text-zinc-500">
                                        {t('admin.settings.reminderHelp')}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
                                <div className="flex-1">
                                    <label
                                        htmlFor="timezone"
                                        className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100"
                                    >
                                        {t('admin.settings.timezoneLabel')}
                                    </label>
                                    <select
                                        id="timezone"
                                        value={formData.timezone}
                                        onChange={(e) =>
                                            updateForm({
                                                timezone: e.target.value,
                                            })
                                        }
                                        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                                    >
                                        {COMMON_TIMEZONES.map((z) => (
                                            <option key={z} value={z}>
                                                {z}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="mt-1.5 text-xs text-zinc-500">
                                        {t('admin.settings.timezoneHelp')}
                                    </p>
                                </div>
                            </div>

                            <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
                                <label
                                    htmlFor="privacy-notice"
                                    className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100"
                                >
                                    {t('admin.settings.privacyNoticeLabel')}
                                </label>
                                <textarea
                                    id="privacy-notice"
                                    value={formData.privacyNoticeText}
                                    onChange={(e) =>
                                        updateForm({
                                            privacyNoticeText: e.target.value,
                                        })
                                    }
                                    rows={4}
                                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                                />
                                <p className="mt-1.5 text-xs text-zinc-500">
                                    {t('admin.settings.privacyNoticeHelp')}
                                </p>
                            </div>

                            <div className="flex items-start gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
                                <input
                                    id="worker-consultation"
                                    type="checkbox"
                                    className="mt-0.5 h-4 w-4 accent-indigo-600"
                                    checked={
                                        formData.workerConsultationAcknowledged
                                    }
                                    onChange={(e) =>
                                        updateForm({
                                            workerConsultationAcknowledged:
                                                e.target.checked,
                                        })
                                    }
                                />
                                <div>
                                    <label
                                        htmlFor="worker-consultation"
                                        className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
                                    >
                                        {t('admin.settings.consultationLabel')}
                                    </label>
                                    <p className="mt-1 text-xs text-zinc-500">
                                        {t('admin.settings.consultationHelp')}
                                    </p>
                                </div>
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
