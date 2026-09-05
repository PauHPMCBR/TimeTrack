'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import { useUnsavedChanges } from '@/lib/useUnsavedChanges';
import { useDirty } from '@/lib/useDirty';
import { usePersistedState } from '@/lib/usePersistedState';
import { ADMIN_YEARLY_VACATIONS_YEAR } from '@/lib/storage';
import { defaultNonWorkingDays } from 'shared/src/lib/defaults';
import AdminBackButton from '../../../components/AdminBackButton';
import { YearlyVacationAdminRequest } from '@/schemas/api';
import { parseDateKey } from '@/lib/datetime';
import Button from '@/components/ui/Button';
import TextField from '@/components/ui/TextField';
import {
    ChevronRight,
    ChevronLeft,
    X,
    Copy,
    TriangleAlert,
} from 'lucide-react';

export default function AdminObligatoryVacationsPage() {
    const { t } = useI18n();

    const [year, setYear] = usePersistedState<number>(ADMIN_YEARLY_VACATIONS_YEAR, new Date().getFullYear());
    const [vacationDays, setVacationDays] =
        useState<YearlyVacationAdminRequest | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [obligatoryDays, setObligatoryDays] = useState<Date[]>([]);
    const [electiveDaysTotalCount, setElectiveDaysTotalCount] =
        useState<number>(0);
    const [newDate, setNewDate] = useState<string>('');
    const [copying, setCopying] = useState(false);
    const [nonWorkingDays, setNonWorkingDays] = useState<number[]>(defaultNonWorkingDays());
    const { dirty, markDirty, resetDirty } = useDirty();

    useUnsavedChanges(dirty);

    const fetchYearlyVacations = async () => {
        try {
            setLoading(true);
            setError(null);

            const res = await apiClient.getYearlyVacationsGlobal(year);

            if (res.error) {
                if (res.error === 'EntryNotFound') {
                    setVacationDays(null);
                    setObligatoryDays([]);
                    setElectiveDaysTotalCount(0);
                } else {
                    setError(
                        t(`error.${res.error}`) ||
                            res.error ||
                            t('error.GetError')
                    );
                }
            } else if (res.data?.vacations) {
                setVacationDays(res.data.vacations);
                setObligatoryDays(
                    res.data.vacations.obligatoryDays.map(
                        (date) => new Date(date)
                    )
                );
                setElectiveDaysTotalCount(
                    res.data.vacations.electiveDaysTotalCount
                );
            }
        } catch (error) {
            console.error('Error loading yearly vacations:', error);
            setError(t('error.GetError') || 'Error loading data');
        } finally {
            resetDirty();
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchYearlyVacations();
    }, [year]);

    useEffect(() => {
        apiClient.getSettings().then((res) => {
            if (!res.error && res.data?.settings) {
                setNonWorkingDays(res.data.settings.nonWorkingDays ?? defaultNonWorkingDays());
            }
        });
    }, []);

    const handleYearChange = (newYear: number) => {
        if (dirty && !window.confirm(t('common.unsavedChangesConfirm'))) return;
        setYear(newYear);
    };

    const handleAddDate = () => {
        if (!newDate) return;

        const date = parseDateKey(newDate);
        if (isNaN(date.getTime())) {
            setError(t('admin.vacationsSetup.invalidDate') || 'Invalid date');
            return;
        }

        const exists = obligatoryDays.some(
            (d) =>
                d.getFullYear() === date.getFullYear() &&
                d.getMonth() === date.getMonth() &&
                d.getDate() === date.getDate()
        );

        if (exists) {
            setError(
                t('admin.vacationsSetup.dateExists') || 'Date already exists'
            );
            return;
        }

        const newDays = [...obligatoryDays, date].sort(
            (a, b) => a.getTime() - b.getTime()
        );
        setObligatoryDays(newDays);
        markDirty();
        setNewDate('');
        setError(null);
    };

    const handleRemoveDate = (index: number) => {
        const newDays = [...obligatoryDays];
        newDays.splice(index, 1);
        setObligatoryDays(newDays);
        markDirty();
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setError(null);
            setSuccess(null);

            const vacationData: YearlyVacationAdminRequest = {
                year,
                obligatoryDays,
                electiveDaysTotalCount,
            };

            const res = await apiClient.setYearlyVacationsAdmin(vacationData);

            if (res.error) {
                setError(res.error || t('error.PostError'));
            } else {
                const successMessage = vacationDays
                    ? t('admin.vacationsSetup.saveSubtitleUpdate').replace(
                          '{year}',
                          year.toString()
                      )
                    : t('admin.vacationsSetup.saveSubtitleCreate').replace(
                          '{year}',
                          year.toString()
                      );
                setSuccess(successMessage);

                setVacationDays(vacationData);
                resetDirty();

                setTimeout(() => setSuccess(null), 3000);
            }
        } catch (error) {
            console.error('Error saving vacations:', error);
            setError(t('error.PostError') || 'Error saving data');
        } finally {
            setSaving(false);
        }
    };

    const handleCopyFromPreviousYear = async () => {
        try {
            setCopying(true);
            setError(null);
            setSuccess(null);

            // Load the previous year's data into the current editing state without
            // persisting anything — only "Save" writes to the database.
            const res = await apiClient.getYearlyVacationsGlobal(year - 1);

            if (res.error || !res.data?.vacations) {
                setError(
                    t('admin.vacationsSetup.copyNotFound').replace(
                        '{year}',
                        (year - 1).toString()
                    )
                );
            } else {
                setObligatoryDays(
                    res.data.vacations.obligatoryDays.map(
                        (date) => new Date(date)
                    )
                );
                setElectiveDaysTotalCount(
                    res.data.vacations.electiveDaysTotalCount
                );
                markDirty();
                setSuccess(
                    t('admin.vacationsSetup.copySuccess')
                        .replace('{year}', (year - 1).toString())
                        .replace('{toYear}', year.toString())
                );
                setTimeout(() => setSuccess(null), 4000);
            }
        } catch (error) {
            console.error('Error copying vacations:', error);
            setError(t('error.PostError') || 'Error copying data');
        } finally {
            setCopying(false);
        }
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    const isNonWorkingDay = (date: Date) =>
        nonWorkingDays.includes(date.getDay());

    const realObligatoryCount = obligatoryDays.filter(
        (d) => !isNonWorkingDay(d)
    ).length;

    const datesByMonth = () => {
        const groups: Record<string, Date[]> = {};

        obligatoryDays.forEach((date) => {
            const monthYear = date.toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
            });
            if (!groups[monthYear]) {
                groups[monthYear] = [];
            }
            groups[monthYear].push(date);
        });

        return groups;
    };

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
            {/* CONTENT */}
            <div className="mx-auto max-w-4xl px-4 py-6">
                <AdminBackButton />

                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                                {t('admin.vacationsSetup.title')}
                            </h1>
                            <p className="mt-1 text-sm text-zinc-500">
                                {t('admin.vacationsSetup.subtitle')}
                            </p>
                        </div>

                        {/* Year selector */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleYearChange(year - 1)}
                                className="rounded-lg border border-zinc-300 bg-white p-2 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                                disabled={loading || saving}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>

                            <div className="min-w-[100px] text-center">
                                <span className="text-lg font-semibold text-zinc-900 dark:text-white">
                                    {year}
                                </span>
                            </div>

                            <button
                                onClick={() => handleYearChange(year + 1)}
                                className="rounded-lg border border-zinc-300 bg-white p-2 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                                disabled={loading || saving}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Messages */}
                {error && (
                    <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
                        {error}
                        <button
                            onClick={() => setError(null)}
                            className="ml-2 text-sm underline"
                        >
                            {t('common.close')}
                        </button>
                    </div>
                )}

                {success && (
                    <div className="mb-6 rounded-lg bg-green-50 p-4 text-green-600 dark:bg-green-900/20 dark:text-green-400">
                        {success}
                        <button
                            onClick={() => setSuccess(null)}
                            className="ml-2 text-sm underline"
                        >
                            {t('common.close')}
                        </button>
                    </div>
                )}

                {loading ? (
                    <div className="p-10 text-center animate-pulse text-zinc-500">
                        {t('common.loading')}
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* --- UNSAVED CHANGES WARNING --- */}
                        {dirty && (
                            <section className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/20">
                                <TriangleAlert
                                    size={20}
                                    className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
                                />
                                <div>
                                    <div className="text-sm font-medium text-amber-800 dark:text-amber-300">
                                        {t(
                                            'admin.vacationsSetup.unsavedWarning'
                                        ).replace('{year}', year.toString())}
                                    </div>
                                    <div className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                                        {t('admin.vacationsSetup.unsavedHint')}
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* --- COPY FROM PREVIOUS YEAR --- */}
                        <section className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div>
                                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                                        <Copy
                                            size={18}
                                            className="text-indigo-500"
                                        />
                                        {t('admin.vacationsSetup.copyTitle')}
                                    </h2>
                                    <p className="mt-1 text-sm text-zinc-500">
                                        {t('admin.vacationsSetup.copySubtitle')
                                            .replace(
                                                '{year}',
                                                (year - 1).toString()
                                            )
                                            .replace(
                                                '{toYear}',
                                                year.toString()
                                            )}
                                    </p>
                                </div>
                                <Button
                                    onClick={handleCopyFromPreviousYear}
                                    disabled={copying || loading}
                                    variant="soft"
                                    className="shrink-0"
                                >
                                    <Copy size={16} />
                                    {copying
                                        ? t('common.loading')
                                        : t(
                                              'admin.vacationsSetup.copyButton'
                                          ).replace(
                                              '{year}',
                                              (year - 1).toString()
                                          )}
                                </Button>
                            </div>
                        </section>

                        {/* --- OBLIGATORY VACATIONS --- */}
                        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                            <div className="mb-6">
                                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-blue-400"></span>
                                    {t('admin.vacationsSetup.obligatoryTitle')}
                                </h2>
                                <p className="mt-1 text-sm text-zinc-500">
                                    {t(
                                        'admin.vacationsSetup.obligatorySubtitle'
                                    )}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                    <span className="rounded-full bg-blue-100 px-2.5 py-0.5 font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                        {t(
                                            'admin.vacationsSetup.obligatoryTotal'
                                        )}
                                        : {obligatoryDays.length}
                                    </span>
                                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                        {t(
                                            'admin.vacationsSetup.obligatoryReal'
                                        )}
                                        : {realObligatoryCount}
                                    </span>
                                </div>
                            </div>

                            {/* Add new date form */}
                            <div className="mb-6 flex flex-col sm:flex-row gap-3">
                                <div className="flex-1">
                                    <TextField
                                        label={t(
                                            'admin.vacationsSetup.addDate'
                                        )}
                                        type="date"
                                        value={newDate}
                                        onChange={(e) =>
                                            setNewDate(e.target.value)
                                        }
                                    />
                                </div>
                                <div className="flex items-end">
                                    <Button
                                        onClick={handleAddDate}
                                        disabled={!newDate || saving}
                                        variant="primary"
                                    >
                                        {t('admin.vacationsSetup.addButton')}
                                    </Button>
                                </div>
                            </div>

                            {/* Dates list */}
                            {obligatoryDays.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
                                    {t('admin.vacationsSetup.noDates')}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {Object.entries(datesByMonth()).map(
                                        ([monthYear, dates]) => (
                                            <div
                                                key={monthYear}
                                                className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
                                            >
                                                <div className="bg-zinc-100 dark:bg-zinc-800 px-4 py-3">
                                                    <h3 className="font-medium text-zinc-900 dark:text-white">
                                                        {monthYear}{' '}
                                                        <span className="text-sm text-zinc-500">
                                                            ({dates.length}{' '}
                                                            days)
                                                        </span>
                                                    </h3>
                                                </div>
                                                <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                                    {dates.map((date) => {
                                                        const nonWorking =
                                                            isNonWorkingDay(
                                                                date
                                                            );
                                                        return (
                                                            <div
                                                                key={date.toISOString()}
                                                                className={`flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${nonWorking ? 'bg-red-50/60 dark:bg-red-950/20' : ''}`}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div
                                                                        className={`flex h-8 w-8 items-center justify-center rounded-full ${nonWorking ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'}`}
                                                                    >
                                                                        <span className="text-sm font-medium">
                                                                            {date.getDate()}
                                                                        </span>
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-sm font-medium text-zinc-900 dark:text-white">
                                                                            {formatDate(
                                                                                date
                                                                            )}
                                                                        </div>
                                                                        <div
                                                                            className={`text-xs ${nonWorking ? 'text-red-500 dark:text-red-400' : 'text-zinc-500'}`}
                                                                        >
                                                                            {date.toLocaleDateString(
                                                                                'en-US',
                                                                                {
                                                                                    weekday:
                                                                                        'long',
                                                                                }
                                                                            )}
                                                                            {nonWorking
                                                                                ? ` · ${t('admin.vacationsSetup.nonWorkingDay')}`
                                                                                : ''}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={() =>
                                                                        handleRemoveDate(
                                                                            obligatoryDays.indexOf(
                                                                                date
                                                                            )
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        saving
                                                                    }
                                                                    className="rounded-lg p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                                                                >
                                                                    <X className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )
                                    )}
                                </div>
                            )}
                        </section>

                        {/* --- ELECTIVE DAYS SETTINGS --- */}
                        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                            <div className="mb-6">
                                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-green-400"></span>
                                    {t('admin.vacationsSetup.electiveTitle')}
                                </h2>
                                <p className="mt-1 text-sm text-zinc-500">
                                    {t('admin.vacationsSetup.electiveSubtitle')}
                                </p>
                            </div>

                            <div className="">
                                <label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                    {t(
                                        'admin.vacationsSetup.electiveDaysLabel'
                                    )}
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="0"
                                        max="366"
                                        value={electiveDaysTotalCount}
                                        onChange={(e) => {
                                            const value =
                                                parseInt(e.target.value) || 0;
                                            setElectiveDaysTotalCount(
                                                Math.min(30, Math.max(0, value))
                                            );
                                            markDirty();
                                        }}
                                        className="w-24 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-center text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 dark:border-zinc-700 dark:text-white"
                                    />
                                    <span className="text-sm text-zinc-500">
                                        {t('admin.vacationsSetup.days')}
                                    </span>
                                </div>
                                <p className="mt-2 text-sm text-zinc-500">
                                    {t('admin.vacationsSetup.electiveHelp')}
                                </p>
                            </div>
                        </section>

                        {/* --- SAVE BUTTON --- */}
                        <div className="sticky bottom-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-medium text-zinc-900 dark:text-white">
                                        {t('admin.vacationsSetup.saveTitle')}
                                    </div>
                                    <div className="text-sm text-zinc-500">
                                        {vacationDays
                                            ? t(
                                                  'admin.vacationsSetup.saveSubtitleUpdate'
                                              ).replace(
                                                  '{year}',
                                                  year.toString()
                                              )
                                            : t(
                                                  'admin.vacationsSetup.saveSubtitleCreate'
                                              ).replace(
                                                  '{year}',
                                                  year.toString()
                                              )}
                                    </div>
                                </div>
                                <Button
                                    onClick={handleSave}
                                    disabled={saving}
                                    variant="primary"
                                    className="px-6 py-3"
                                >
                                    {saving ? (
                                        <span className="flex items-center gap-2">
                                            <svg
                                                className="h-4 w-4 animate-spin text-white"
                                                xmlns="http://www.w3.org/2000/svg"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                            >
                                                <circle
                                                    className="opacity-25"
                                                    cx="12"
                                                    cy="12"
                                                    r="10"
                                                    stroke="currentColor"
                                                    strokeWidth="4"
                                                ></circle>
                                                <path
                                                    className="opacity-75"
                                                    fill="currentColor"
                                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                ></path>
                                            </svg>
                                            {t('common.saving') || 'Saving...'}
                                        </span>
                                    ) : (
                                        t('common.save')
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
