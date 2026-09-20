'use client';

import { useState, useEffect } from 'react';
import LoadingState from '@/components/ui/LoadingState';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import { useUnsavedChanges } from '@/lib/useUnsavedChanges';
import { useDirty } from '@/lib/useDirty';
import { usePersistedState } from '@/lib/usePersistedState';
import { ADMIN_YEARLY_VACATIONS_YEAR } from '@/lib/storage';
import AdminBackButton from '../../../components/AdminBackButton';
import { YearlyVacationAdminRequest } from '@/schemas/api';
import { YearlyVacationDays } from '@/types';
import { formatDateKey, localeTag } from '@/lib/datetime';
import type { DateKey, DateKeyInterval } from 'shared/src/lib/day-key';
import { DateKeySchema, dowFromDateKey } from 'shared/src/lib/day-key';
import { expandIntervalsToDayKeys } from 'shared/src/lib/vacation-days';
import { nonWorkingDaysOfWeek } from 'shared/src/lib/user-overrides';
import Button from '@/components/ui/Button';
import TextField from '@/components/ui/TextField';
import TextAreaField from '@/components/ui/TextAreaField';
import OptionPicker from '@/components/ui/OptionPicker';
import Modal from '@/components/Modal';
import {
    X,
    Copy,
    TriangleAlert,
    CalendarOff,
    Plus,
    Pencil,
} from 'lucide-react';
import StepperNav from '@/components/ui/StepperNav';
import EmptyState from '@/components/ui/EmptyState';
import { defaultWeeklyExpectedHours } from 'shared/src/lib/defaults';

export default function AdminObligatoryVacationsPage() {
    const { t, lang } = useI18n();

    const [year, setYear] = usePersistedState<number>(
        ADMIN_YEARLY_VACATIONS_YEAR,
        new Date().getFullYear()
    );
    const [vacationDays, setVacationDays] = useState<YearlyVacationDays | null>(
        null
    );
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [obligatoryIntervals, setObligatoryIntervals] = useState<
        DateKeyInterval[]
    >([]);
    const [electiveDaysTotalCount, setElectiveDaysTotalCount] =
        useState<number>(0);
    const [copying, setCopying] = useState(false);
    const [nonWorkingDays, setNonWorkingDays] = useState<number[]>([0, 6]);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [mode, setMode] = useState<'day' | 'interval'>('day');
    const [modalStart, setModalStart] = useState<string>('');
    const [modalEnd, setModalEnd] = useState<string>('');
    const [modalNotes, setModalNotes] = useState<string>('');
    const [modalError, setModalError] = useState<string | null>(null);
    const { dirty, markDirty, resetDirty } = useDirty();
    const {
        dirty: modalDirty,
        markDirty: markModalDirty,
        resetDirty: resetModalDirty,
    } = useDirty();

    useUnsavedChanges(dirty);

    const fetchYearlyVacations = async () => {
        try {
            setLoading(true);
            setError(null);

            const res = await apiClient.getYearlyVacationsGlobal(year);

            if (res.error) {
                if (res.error === 'EntryNotFound') {
                    setVacationDays(null);
                    setObligatoryIntervals([]);
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
                setObligatoryIntervals(
                    res.data.vacations.obligatoryIntervals ?? []
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
                setNonWorkingDays(
                    nonWorkingDaysOfWeek(
                        res.data.settings.defaultWeeklyExpectedHours ??
                            defaultWeeklyExpectedHours()
                    )
                );
            }
        });
    }, []);

    const handleYearChange = (newYear: number) => {
        if (dirty && !window.confirm(t('common.unsavedChangesConfirm'))) return;
        setYear(newYear);
    };

    const openAddModal = () => {
        setEditingIndex(null);
        setMode('day');
        setModalStart('');
        setModalEnd('');
        setModalNotes('');
        setModalError(null);
        resetModalDirty();
        setModalOpen(true);
    };

    const openEditModal = (index: number) => {
        const interval = obligatoryIntervals[index];
        setEditingIndex(index);
        setMode(interval.startDate === interval.endDate ? 'day' : 'interval');
        setModalStart(interval.startDate);
        setModalEnd(interval.endDate);
        setModalNotes(interval.notes ?? '');
        setModalError(null);
        resetModalDirty();
        setModalOpen(true);
    };

    const requestCloseModal = () => {
        if (
            modalDirty &&
            !window.confirm(t('common.unsavedChangesConfirm'))
        ) {
            return;
        }
        setModalOpen(false);
        setEditingIndex(null);
        resetModalDirty();
    };

    const handleSaveInterval = () => {
        const end = mode === 'day' ? modalStart : modalEnd;
        const startParsed = DateKeySchema.safeParse(modalStart);
        const endParsed = DateKeySchema.safeParse(end);

        if (!startParsed.success || !endParsed.success) {
            setModalError(
                t('admin.vacationsSetup.invalidDate') || 'Invalid date'
            );
            return;
        }

        const startDate = startParsed.data;
        const endDate = endParsed.data;

        if (endDate < startDate) {
            setModalError(
                t('admin.vacationsSetup.invalidInterval') || 'Invalid interval'
            );
            return;
        }

        if (
            obligatoryIntervals.some(
                (interval, index) =>
                    index !== editingIndex &&
                    interval.startDate === startDate &&
                    interval.endDate === endDate
            )
        ) {
            setModalError(
                t('admin.vacationsSetup.dateExists') || 'Date already exists'
            );
            return;
        }

        const notes = modalNotes.trim();
        const entry: DateKeyInterval = {
            startDate,
            endDate,
            ...(notes ? { notes } : {}),
        };
        const next = [...obligatoryIntervals];
        if (editingIndex === null) {
            next.push(entry);
        } else {
            next[editingIndex] = entry;
        }
        next.sort((a, b) => a.startDate.localeCompare(b.startDate));

        setObligatoryIntervals(next);
        markDirty();
        setModalOpen(false);
        setEditingIndex(null);
        resetModalDirty();
    };

    const handleRemoveInterval = (index: number) => {
        const next = [...obligatoryIntervals];
        next.splice(index, 1);
        setObligatoryIntervals(next);
        markDirty();
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setError(null);
            setSuccess(null);

            const vacationData: YearlyVacationAdminRequest = {
                year,
                obligatoryIntervals,
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

                // Keep the "existing plan" marker in sync with what was saved.
                setVacationDays({
                    _id: vacationDays?._id ?? '',
                    year,
                    obligatoryIntervals,
                    electiveDaysTotalCount,
                });
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
                setObligatoryIntervals(
                    res.data.vacations.obligatoryIntervals ?? []
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

    const formatDate = (key: string) => {
        return formatDateKey(key, localeTag(lang), {
            weekday: 'short',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    const isNonWorkingDay = (key: string) =>
        nonWorkingDays.includes(dowFromDateKey(key as DateKey));

    const countLabel = (count: number, singular: string, plural: string) =>
        `${count} ${t(count === 1 ? singular : plural)}`;

    const obligatoryDays = expandIntervalsToDayKeys(obligatoryIntervals);

    const realObligatoryCount = obligatoryDays.filter(
        (key) => !isNonWorkingDay(key)
    ).length;

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
                            <StepperNav
                                onPrev={() => handleYearChange(year - 1)}
                                onNext={() => handleYearChange(year + 1)}
                                prevDisabled={loading || saving}
                                nextDisabled={loading || saving}
                                centerClassName="min-w-[100px]"
                            >
                                <span className="text-lg font-semibold text-zinc-900 dark:text-white">
                                    {year}
                                </span>
                            </StepperNav>
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
                    <LoadingState />
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

                            {/* Add new obligatory entry */}
                            <div className="mb-6 flex justify-end">
                                <Button
                                    onClick={openAddModal}
                                    disabled={saving}
                                    variant="primary"
                                >
                                    <Plus size={16} />
                                    {t('admin.vacationsSetup.addButton')}
                                </Button>
                            </div>

                            {/* Obligatory entries list */}
                            {obligatoryIntervals.length === 0 ? (
                                <EmptyState
                                    icon={<CalendarOff size={24} />}
                                    title={t('admin.vacationsSetup.noDates')}
                                />
                            ) : (
                                <div className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                                    {obligatoryIntervals.map(
                                        (interval, index) => {
                                            const singleDay =
                                                interval.startDate ===
                                                interval.endDate;
                                            const days =
                                                expandIntervalsToDayKeys([
                                                    interval,
                                                ]);
                                            const realDays = days.filter(
                                                (key) => !isNonWorkingDay(key)
                                            ).length;
                                            const hasNonWorkingDay =
                                                realDays < days.length;
                                            return (
                                                <div
                                                    key={`${interval.startDate}-${interval.endDate}-${index}`}
                                                    className={`flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${hasNonWorkingDay ? 'bg-red-50/60 dark:bg-red-950/20' : ''}`}
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            openEditModal(index)
                                                        }
                                                        className="flex min-w-0 flex-1 items-center justify-between gap-4 text-left"
                                                    >
                                                        <div className="min-w-0">
                                                            <div className="truncate text-sm font-medium text-zinc-900 dark:text-white">
                                                                {singleDay
                                                                    ? formatDate(
                                                                          interval.startDate
                                                                      )
                                                                    : `${formatDate(interval.startDate)} - ${formatDate(interval.endDate)}`}
                                                            </div>
                                                            {interval.notes && (
                                                                <div className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                                                                    {
                                                                        interval.notes
                                                                    }
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="shrink-0 text-right">
                                                            <div
                                                                className={`text-sm font-semibold tabular-nums ${hasNonWorkingDay ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-white'}`}
                                                            >
                                                                {countLabel(
                                                                    days.length,
                                                                    'admin.vacationsSetup.day',
                                                                    'admin.vacationsSetup.days'
                                                                )}
                                                            </div>
                                                            {!singleDay ? (
                                                                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                                                    {countLabel(
                                                                        realDays,
                                                                        'admin.vacationsSetup.realDay',
                                                                        'admin.vacationsSetup.realDays'
                                                                    )}
                                                                </div>
                                                            ) : hasNonWorkingDay ? (
                                                                <div className="text-xs text-red-500 dark:text-red-400">
                                                                    {t(
                                                                        'admin.vacationsSetup.nonWorkingDay'
                                                                    )}
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    </button>
                                                    <div className="flex shrink-0 gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                openEditModal(
                                                                    index
                                                                )
                                                            }
                                                            disabled={saving}
                                                            title={t(
                                                                'common.edit'
                                                            )}
                                                            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                handleRemoveInterval(
                                                                    index
                                                                )
                                                            }
                                                            disabled={saving}
                                                            title={t(
                                                                'common.delete'
                                                            )}
                                                            className="rounded-lg p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        }
                                    )}
                                </div>
                            )}
                        </section>

                        {modalOpen && typeof document !== 'undefined' && (
                            <Modal
                                open
                                title={
                                    editingIndex === null
                                        ? t('admin.vacationsSetup.addTitle')
                                        : t('admin.vacationsSetup.editTitle')
                                }
                                onClose={requestCloseModal}
                                footer={
                                    <div className="flex justify-end gap-2">
                                        <Button
                                            onClick={requestCloseModal}
                                            variant="secondary"
                                            disabled={saving}
                                        >
                                            {t('common.cancel')}
                                        </Button>
                                        <Button
                                            onClick={handleSaveInterval}
                                            variant="primary"
                                            disabled={saving}
                                        >
                                            {t('common.save')}
                                        </Button>
                                    </div>
                                }
                            >
                                {modalError && (
                                    <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                                        {modalError}
                                    </div>
                                )}
                                <div className="space-y-3">
                                    <OptionPicker
                                        value={mode}
                                        onChange={(value) => {
                                            setMode(value);
                                            setModalEnd('');
                                            setModalError(null);
                                            markModalDirty();
                                        }}
                                        options={[
                                            {
                                                value: 'day',
                                                label: t(
                                                    'admin.vacationsSetup.modeDay'
                                                ),
                                            },
                                            {
                                                value: 'interval',
                                                label: t(
                                                    'admin.vacationsSetup.modeInterval'
                                                ),
                                            },
                                        ]}
                                    />
                                    <TextField
                                        label={
                                            mode === 'day'
                                                ? t(
                                                      'admin.vacationsSetup.addDate'
                                                  )
                                                : t(
                                                      'admin.vacationsSetup.startDate'
                                                  )
                                        }
                                        type="date"
                                        value={modalStart}
                                        disabled={saving}
                                        onChange={(e) => {
                                            setModalStart(e.target.value);
                                            markModalDirty();
                                        }}
                                    />
                                    {mode === 'interval' && (
                                        <TextField
                                            label={t(
                                                'admin.vacationsSetup.endDate'
                                            )}
                                            type="date"
                                            min={modalStart}
                                            value={modalEnd}
                                            disabled={saving}
                                            onChange={(e) => {
                                                setModalEnd(e.target.value);
                                                markModalDirty();
                                            }}
                                        />
                                    )}
                                    <TextAreaField
                                        label={t(
                                            'admin.vacationsSetup.notes'
                                        )}
                                        value={modalNotes}
                                        maxLength={1000}
                                        rows={2}
                                        disabled={saving}
                                        placeholder={t(
                                            'admin.vacationsSetup.notesPlaceholder'
                                        )}
                                        onChange={(e) => {
                                            setModalNotes(e.target.value);
                                            markModalDirty();
                                        }}
                                    />
                                </div>
                            </Modal>
                        )}

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
