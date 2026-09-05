'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import { ElectiveVacation, YearlyVacationDays } from '@/types';
import {
    Check,
    Timer,
    Layers,
    AlertCircle,
    Trash2,
    CalendarDays,
    CalendarOff,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import VacationMonthsTable from '@/components/VacationMonthsTable';
import { localeTag, parseDateKey } from '@/lib/datetime';
import {
    VACATION_APPROVED,
    VACATION_PENDING,
    VACATION_REJECTED,
} from 'shared/src/lib/constants';
import { DEFAULT_ELECTIVE_VACATION_DAYS, defaultNonWorkingDays } from 'shared/src/lib/defaults';
import { countSpentVacationDays } from 'shared/src/lib/vacation-days';

export default function MyVacationsPage() {
    const { t, lang } = useI18n();

    const [vacations, setVacations] = useState<ElectiveVacation[]>([]);
    const [stats, setStats] = useState<YearlyVacationDays | null>(null);
    const [loading, setLoading] = useState(true);
    const [availableYears, setAvailableYears] = useState<number[] | null>(null);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [yearLoading, setYearLoading] = useState(false);

    const [date, setDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [vacationsToCancel, setVacationsToCancel] = useState<string[]>([]);
    const [isCancelling, setIsCancelling] = useState(false);

    const [nonWorkingDays, setNonWorkingDays] = useState<number[]>(
        defaultNonWorkingDays()
    );
    const [companyTimezone, setCompanyTimezone] = useState<string | undefined>(
        undefined
    );

    const fetchData = useCallback(async (year: number) => {
        setYearLoading(true);
        try {
            const user = await apiClient.getCurrentUser();
            if (user) {
                const res = await apiClient.getUserVacations(user._id, year);

                if (res.data) {
                    setVacations(res.data.electives || []);
                    setStats(res.data.yearlyVacationDays || null);
                }

                // Non-working days: prefer the user's own override, else the
                // company setting (same rule as the calendar page).
                const settingsRes = await apiClient.getSettings();
                if (user.workDays && user.workDays.length > 0) {
                    const allDays = [0, 1, 2, 3, 4, 5, 6];
                    setNonWorkingDays(
                        allDays.filter((d) => !user.workDays!.includes(d))
                    );
                } else if (!settingsRes.error && settingsRes.data?.settings) {
                    setNonWorkingDays(
                        settingsRes.data.settings.nonWorkingDays ??
                            defaultNonWorkingDays()
                    );
                }
                // Same company timezone the backend resolves day bounds with.
                if (!settingsRes.error && settingsRes.data?.settings?.timezone) {
                    setCompanyTimezone(settingsRes.data.settings.timezone);
                }
            }
        } catch (error) {
            console.error('Error carregant vacances:', error);
        } finally {
            setYearLoading(false);
            setLoading(false);
        }
    }, []);

    // Load the years that have a company vacation plan, then default the
    // picker to the current year (or the most recent available one).
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await apiClient.getVacationYears();
                if (cancelled) return;
                const years = res.data?.years ?? [];
                setAvailableYears(years);
                const current = new Date().getFullYear();
                setSelectedYear(
                    years.includes(current) ? current : (years[0] ?? current)
                );
            } catch (error) {
                console.error('Error carregant anys:', error);
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (availableYears === null) return;
        fetchData(selectedYear);
    }, [fetchData, selectedYear, availableYears]);

    // Requests are stored as intervals with their spent days already computed
    // by the backend; each document renders as one condensed row.
    const groupedVacations = useMemo(() => {
        return [...vacations]
            .sort(
                (a, b) =>
                    new Date(b.startDate).getTime() -
                    new Date(a.startDate).getTime()
            )
            .map((vac) => ({
                id: vac._id,
                startDate: new Date(vac.startDate),
                endDate: new Date(vac.endDate),
                spentDays: vac.spentDays ?? 0,
                status: vac.status,
                reason: vac.reason,
            }));
    }, [vacations]);

    // Preview of the request cost, computed with the same shared function the
    // backend uses (non-working days, obligatory days, company timezone).
    const requestPreview = useMemo(() => {
        if (!date || !endDate) return null;

        const start = parseDateKey(date);
        const end = parseDateKey(endDate);
        if (end.getTime() < start.getTime()) return null;

        return {
            crossYear: end.getFullYear() !== start.getFullYear(),
            cost: countSpentVacationDays(
                start,
                end,
                nonWorkingDays,
                stats?.obligatoryDays ?? [],
                companyTimezone
            ),
        };
    }, [date, endDate, nonWorkingDays, stats, companyTimezone]);

    const isRequestValid =
        Boolean(date) &&
        Boolean(endDate) &&
        Boolean(requestPreview) &&
        !requestPreview?.crossYear &&
        // A period made up only of non-working/obligatory days costs nothing.
        (requestPreview?.cost ?? 0) > 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isRequestValid) return;

        setSubmitting(true);
        setSuccessMsg(null);
        setErrorMsg(null);

        try {
            // Send plain "YYYY-MM-DD" keys: the backend anchors them to local
            // midnight itself, so the client's timezone can never shift the
            // day. The backend recomputes the spent days.
            const res = await apiClient.createVacation({
                startDate: date,
                endDate: endDate,
                reason: reason.trim() || undefined,
            });

            if (res.error) {
                if (res.error === 'IllegalAction') {
                    const action = (
                        res.details as { illegalAction?: string } | undefined
                    )?.illegalAction;
                    if (action === 'VacationOverlap') {
                        setErrorMsg(t('error.vacationOverlap'));
                    } else if (action === 'VacationCrossYear') {
                        setErrorMsg(t('error.vacationCrossYear'));
                    } else if (action === 'VacationZeroDays') {
                        setErrorMsg(t('error.vacationZeroDays'));
                    } else {
                        setErrorMsg(t('error.vacationLimit'));
                    }
                } else {
                    setErrorMsg(t('error.PostError'));
                }
            } else {
                await fetchData(selectedYear);
                setDate('');
                setEndDate('');
                setReason('');
                setSuccessMsg(t('vacations.success'));
                setTimeout(() => setSuccessMsg(null), 3000);
            }
        } catch (error) {
            console.error(error);
            setErrorMsg(t('error.PostError'));
        } finally {
            setSubmitting(false);
        }
    };

    const openCancelModal = (ids: string[]) => {
        setVacationsToCancel(ids);
        setIsCancelModalOpen(true);
    };

    const closeCancelModal = () => {
        setIsCancelModalOpen(false);
        setVacationsToCancel([]);
    };

    const confirmCancel = async () => {
        if (vacationsToCancel.length === 0) return;

        setIsCancelling(true);
        try {
            await Promise.all(
                vacationsToCancel.map((id) => apiClient.cancelVacation(id))
            );
            await fetchData(selectedYear);
            closeCancelModal();
        } catch (error) {
            console.error(error);
            setErrorMsg(t('error.DeleteError'));
        } finally {
            setIsCancelling(false);
        }
    };

    const totalDays = stats?.electiveDaysTotalCount || DEFAULT_ELECTIVE_VACATION_DAYS;
    // Spent days are computed per request by the backend; pending requests
    // count too (they may still be approved).
    const usedDays = vacations
        .filter(
            (vac) =>
                vac.status === VACATION_PENDING ||
                vac.status === VACATION_APPROVED
        )
        .reduce((sum, vac) => sum + (vac.spentDays ?? 0), 0);
    const remainingDays = totalDays - usedDays;
    // Portion of the used days still awaiting admin confirmation.
    const pendingDays = vacations
        .filter((vac) => vac.status === VACATION_PENDING)
        .reduce((sum, vac) => sum + (vac.spentDays ?? 0), 0);

    const formatDateRange = (start: Date, end: Date) => {
        const s = start.toLocaleDateString();
        const e = end.toLocaleDateString();
        if (s === e) return s;
        return `${s} - ${e}`;
    };

    if (loading)
        return (
            <div className="p-10 text-center animate-pulse text-zinc-500">
                {t('common.loading')}
            </div>
        );

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                        {t('vacations.title')}
                    </h1>
                    <p className="mt-1 text-sm text-zinc-500">
                        {t('vacations.manageDesc')}
                    </p>
                </div>

                {availableYears && availableYears.length > 0 && (
                    <label className="flex items-center gap-2">
                        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                            {t('vacations.yearLabel')}
                        </span>
                        <select
                            value={selectedYear}
                            disabled={yearLoading}
                            onChange={(e) =>
                                setSelectedYear(parseInt(e.target.value))
                            }
                            aria-label={t('vacations.yearLabel')}
                            className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white transition-all disabled:opacity-50"
                        >
                            {availableYears.map((year) => (
                                <option key={year} value={year}>
                                    {year}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
            </div>

            <div className="space-y-8">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Card className="relative overflow-hidden p-6">
                        <dt>
                            <div className="absolute rounded-md bg-indigo-500 p-3">
                                <Check className="h-6 w-6 text-white" />
                            </div>
                            <p className="ml-16 truncate text-sm font-medium text-zinc-500 dark:text-zinc-400">
                                {t('vacations.balance')}
                            </p>
                        </dt>
                        <dd className="ml-16 flex items-baseline">
                            <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                                {remainingDays}
                            </p>
                        </dd>
                    </Card>

                    <Card className="relative overflow-hidden p-6">
                        <dt>
                            <div className="absolute rounded-md bg-zinc-100 p-3 dark:bg-zinc-800">
                                <Timer className="h-6 w-6 text-zinc-600 dark:text-zinc-400" />
                            </div>
                            <p className="ml-16 truncate text-sm font-medium text-zinc-500 dark:text-zinc-400">
                                {t('vacations.used')}
                            </p>
                        </dt>
                        <dd className="ml-16 flex items-baseline gap-2">
                            <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                                {usedDays}
                            </p>
                            {pendingDays > 0 && (
                                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                                    (
                                    {t('vacations.unconfirmed').replace(
                                        '{count}',
                                        pendingDays.toString()
                                    )}
                                    )
                                </span>
                            )}
                        </dd>
                    </Card>

                    <Card className="relative overflow-hidden p-6">
                        <dt>
                            <div className="absolute rounded-md bg-zinc-100 p-3 dark:bg-zinc-800">
                                <Layers className="h-6 w-6 text-zinc-600 dark:text-zinc-400" />
                            </div>
                            <p className="ml-16 truncate text-sm font-medium text-zinc-500 dark:text-zinc-400">
                                {t('vacations.total')}
                            </p>
                        </dt>
                        <dd className="ml-16 flex items-baseline">
                            <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                                {totalDays}
                            </p>
                        </dd>
                    </Card>
                </div>

                <Card className="p-6">
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">
                        {t('vacations.request')}
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2 sm:col-span-1">
                                <label className="mb-1.5 block text-xs font-medium text-zinc-500 uppercase tracking-wide">
                                    {t('vacations.date')}
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white transition-all"
                                />
                            </div>

                            <div className="col-span-2 sm:col-span-1">
                                <label className="mb-1.5 block text-xs font-medium text-zinc-500 uppercase tracking-wide">
                                    {t('vacations.endDate')}
                                </label>
                                <input
                                    type="date"
                                    required
                                    min={date || undefined}
                                    value={endDate}
                                    onChange={(e) =>
                                        setEndDate(e.target.value)
                                    }
                                    className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-zinc-500 uppercase tracking-wide">
                                {t('vacations.reason')}
                            </label>
                            <input
                                type="text"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder={t('vacations.reasonPlaceholder')}
                                className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white transition-all"
                            />
                        </div>

                        {requestPreview && (
                            <div
                                className={`rounded-lg border p-3 text-sm flex items-start gap-2 ${
                                    requestPreview.crossYear ||
                                    requestPreview.cost === 0
                                        ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800'
                                        : 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800'
                                }`}
                            >
                                <CalendarDays className="w-4 h-4 mt-0.5 shrink-0" />
                                <div>
                                    {requestPreview.crossYear ? (
                                        <p>
                                            {t('error.vacationCrossYear')}
                                        </p>
                                    ) : requestPreview.cost === 0 ? (
                                        <p>
                                            {t('error.vacationZeroDays')}
                                        </p>
                                    ) : (
                                        <p>
                                            {t('vacations.previewCost').replace(
                                                '{count}',
                                                requestPreview.cost.toString()
                                            )}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {successMsg && (
                            <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700 flex items-center gap-2 dark:bg-green-900/20 dark:text-green-400 border border-green-200 dark:border-green-800">
                                <Check className="w-4 h-4" />
                                {successMsg}
                            </div>
                        )}

                        {errorMsg && (
                            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800">
                                <AlertCircle className="w-4 h-4" />
                                {errorMsg}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={submitting || !isRequestValid}
                            className="w-full mt-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-md hover:bg-zinc-800 disabled:opacity-50 transition-colors dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                        >
                            {submitting
                                ? t('common.loading')
                                : t('vacations.submit')}
                        </button>
                    </form>
                </Card>

                <div>
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">
                        {t('vacations.obligatoryTitle')}
                    </h2>
                    <p className="text-sm text-zinc-500 mb-4">
                        {t('vacations.obligatoryDesc')}
                    </p>

                    {(stats?.obligatoryDays ?? []).length === 0 ? (
                        <EmptyState
                            icon={<CalendarOff size={24} />}
                            title={t('vacations.obligatoryEmpty')}
                        />
                    ) : (
                        <Card className="p-5">
                            <VacationMonthsTable
                                days={stats?.obligatoryDays ?? []}
                                locale={localeTag(lang)}
                            />
                        </Card>
                    )}
                </div>

                <div>
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">
                        {t('vacations.history')}
                    </h2>

                    {groupedVacations.length === 0 ? (
                        <EmptyState
                            icon={<CalendarDays size={24} />}
                            title={t('vacations.empty')}
                        />
                    ) : (
                        <div className="space-y-3">
                            {groupedVacations.map((group, index) => (
                                <Card
                                    key={`${group.startDate.toString()}-${index}`}
                                    className="group flex items-center justify-between p-4 hover:border-indigo-300 transition-colors dark:hover:border-indigo-700"
                                >
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">📅</span>
                                            <div className="font-semibold text-zinc-900 dark:text-white">
                                                {formatDateRange(
                                                    group.startDate,
                                                    group.endDate
                                                )}
                                            </div>
                                            {group.spentDays > 1 && (
                                                <span className="ml-2 rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                                                    {group.spentDays}{' '}
                                                    {t('vacations.days')}
                                                </span>
                                            )}
                                        </div>
                                        {group.reason && (
                                            <div className="ml-8 text-xs text-zinc-500 mt-0.5">
                                                &quot;{group.reason}&quot;
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <span
                                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                                group.status === VACATION_APPROVED
                                                    ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30'
                                                    : group.status ===
                                                        VACATION_REJECTED
                                                      ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30'
                                                      : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/30'
                                            }`}
                                        >
                                            {t(
                                                `vacations.status.${group.status}`
                                            )}
                                        </span>

                                        {group.status === VACATION_PENDING && (
                                            <button
                                                onClick={() =>
                                                    openCancelModal([group.id])
                                                }
                                                className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors dark:hover:bg-red-900/20"
                                                title={t('vacations.cancel')}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {isCancelModalOpen &&
                typeof document !== 'undefined' &&
                createPortal(
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
                        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800">
                            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30">
                                <Trash2 size={24} />
                            </div>

                            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                                {t('vacations.cancelModal.title')}
                            </h3>
                            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                                {t('vacations.cancelModal.body')}
                            </p>

                            <div className="mt-6 flex gap-3">
                                <Button
                                    variant="secondary"
                                    onClick={closeCancelModal}
                                    disabled={isCancelling}
                                    className="flex-1"
                                >
                                    {t('common.cancel')}
                                </Button>
                                <Button
                                    variant="danger"
                                    onClick={confirmCancel}
                                    disabled={isCancelling}
                                    className="flex-1"
                                >
                                    {isCancelling
                                        ? t('common.loading')
                                        : t('vacations.cancelModal.confirm')}
                                </Button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
        </div>
    );
}
