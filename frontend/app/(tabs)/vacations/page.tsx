'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import { ElectiveVacation, YearlyVacationDays } from '@/types';
import {
    Check,
    Timer,
    Layers,
    AlertTriangle,
    AlertCircle,
    Trash2,
    CalendarDays,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { parseDateKey } from '@/lib/datetime';
import {
    VACATION_APPROVED,
    VACATION_PENDING,
    VACATION_REJECTED,
} from 'shared/src/lib/constants';
import { DEFAULT_ELECTIVE_VACATION_DAYS } from 'shared/src/lib/defaults';

type GroupedVacation = {
    ids: string[];
    startDate: Date;
    endDate: Date;
    daysCount: number;
    status: string;
    reason?: string;
};

export default function MyVacationsPage() {
    const { t } = useI18n();

    const [vacations, setVacations] = useState<ElectiveVacation[]>([]);
    const [stats, setStats] = useState<YearlyVacationDays | null>(null);
    const [loading, setLoading] = useState(true);

    const [date, setDate] = useState('');
    const [daysCount, setDaysCount] = useState(1);
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [warningMsg, setWarningMsg] = useState<string | null>(null);

    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [vacationsToCancel, setVacationsToCancel] = useState<string[]>([]);
    const [isCancelling, setIsCancelling] = useState(false);

    const fetchData = async () => {
        try {
            const user = await apiClient.getCurrentUser();
            if (user) {
                const currentYear = new Date().getFullYear();
                const res = await apiClient.getUserVacations(
                    user._id,
                    currentYear
                );

                if (res.data) {
                    setVacations(res.data.electives || []);
                    setStats(res.data.yearlyVacationDays || null);
                }
            }
        } catch (error) {
            console.error('Error carregant vacances:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const groupedVacations = useMemo(() => {
        if (vacations.length === 0) return [];

        const sorted = [...vacations].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        const groups: GroupedVacation[] = [];

        sorted.forEach((vac) => {
            const vacDate = new Date(vac.date);
            vacDate.setHours(0, 0, 0, 0);

            const lastGroup = groups[groups.length - 1];

            if (lastGroup) {
                const groupStartDate = new Date(lastGroup.startDate);
                groupStartDate.setHours(0, 0, 0, 0);

                const diffTime = groupStartDate.getTime() - vacDate.getTime();
                const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

                const isConsecutive = diffDays === 1;
                const sameStatus = lastGroup.status === vac.status;
                const sameReason =
                    (lastGroup.reason || '') === (vac.reason || '');

                if (isConsecutive && sameStatus && sameReason) {
                    lastGroup.startDate = new Date(vac.date);
                    lastGroup.ids.push(vac._id);
                    lastGroup.daysCount += 1;
                    return;
                }
            }

            groups.push({
                ids: [vac._id],
                startDate: new Date(vac.date),
                endDate: new Date(vac.date),
                daysCount: 1,
                status: vac.status,
                reason: vac.reason,
            });
        });

        return groups;
    }, [vacations]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!date) return;

        setSubmitting(true);
        setSuccessMsg(null);
        setErrorMsg(null);
        setWarningMsg(null);

        try {
            // Parse the "YYYY-MM-DD" input as local midnight so the request
            // always targets the wall-clock day the user selected.
            const startDate = parseDateKey(date);
            const reasonToSend = reason.trim() || undefined;

            let createdCount = 0;
            let errorCount = 0;
            let limitExceeded = false;

            for (let i = 0; i < daysCount; i++) {
                const dateToSend = new Date(startDate);
                dateToSend.setDate(startDate.getDate() + i);

                const res = await apiClient.createVacation({
                    date: dateToSend,
                    reason: reasonToSend,
                });

                if (res.error) {
                    errorCount++;
                    if (res.error === 'IllegalAction') {
                        limitExceeded = true;
                    }
                } else {
                    createdCount++;
                }
            }

            if (createdCount > 0) {
                await fetchData();
                setDate('');
                setDaysCount(1);
                setReason('');
            }

            if (createdCount > 0 && errorCount === 0) {
                setSuccessMsg(t('vacations.success'));
                setTimeout(() => setSuccessMsg(null), 3000);
            } else if (createdCount > 0 && errorCount > 0) {
                const msg = t('error.partialVacation')
                    .replace('{created}', createdCount.toString())
                    .replace('{failed}', errorCount.toString());
                setWarningMsg(msg);
            } else {
                if (limitExceeded) setErrorMsg(t('error.vacationLimit'));
                else setErrorMsg(t('error.PostError'));
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
            await fetchData();
            closeCancelModal();
        } catch (error) {
            console.error(error);
            setErrorMsg(t('error.DeleteError'));
        } finally {
            setIsCancelling(false);
        }
    };

    const totalDays = stats?.electiveDaysTotalCount || DEFAULT_ELECTIVE_VACATION_DAYS;
    const usedDays = stats?.selectedElectiveDays?.length || 0;
    const remainingDays = totalDays - usedDays;

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
            <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                    {t('vacations.title')}
                </h1>
                <p className="mt-1 text-sm text-zinc-500">
                    {t('vacations.manageDesc')}
                </p>
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
                        <dd className="ml-16 flex items-baseline">
                            <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                                {usedDays}
                            </p>
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
                                    {t('vacations.consecutiveDays')}
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="1"
                                        max="30"
                                        required
                                        value={daysCount}
                                        onChange={(e) => {
                                            const val = parseInt(
                                                e.target.value
                                            );
                                            setDaysCount(
                                                isNaN(val)
                                                    ? 1
                                                    : Math.max(1, val)
                                            );
                                        }}
                                        className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white transition-all"
                                    />
                                    <span className="absolute right-8 top-1/2 -translate-y-1/2 text-xs text-zinc-400 pointer-events-none">
                                        {daysCount === 1
                                            ? t('vacations.day')
                                            : t('vacations.days')}
                                    </span>
                                </div>
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

                        {successMsg && (
                            <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700 flex items-center gap-2 dark:bg-green-900/20 dark:text-green-400 border border-green-200 dark:border-green-800">
                                <Check className="w-4 h-4" />
                                {successMsg}
                            </div>
                        )}

                        {warningMsg && (
                            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700 flex items-center gap-2 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                <AlertTriangle className="w-4 h-4" />
                                {warningMsg}
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
                            disabled={submitting}
                            className="w-full mt-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-md hover:bg-zinc-800 disabled:opacity-50 transition-colors dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                        >
                            {submitting
                                ? t('common.loading')
                                : t('vacations.submit')}
                        </button>
                    </form>
                </Card>

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
                                            {group.daysCount > 1 && (
                                                <span className="ml-2 rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                                                    {group.daysCount}{' '}
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
                                                    openCancelModal(group.ids)
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
