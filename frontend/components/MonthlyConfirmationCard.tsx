'use client';

import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import { localeTag, toLocalDateKey } from '@/lib/datetime';
import { MonthlyApprovalRow } from '@/schemas/api';
import {
    APPROVAL_APPROVED,
    APPROVAL_PENDING,
} from 'shared/src/lib/constants';
import Card from '@/components/ui/Card';
import MonthYearGrid, {
    MonthCellState,
    monthStateClasses,
} from '@/components/MonthYearGrid';

type MonthlyConfirmationCardProps = {
    /** Called after a month is confirmed, so the page can refresh its state. */
    onApproved?: (userId: string, year: number, month: number) => void;
};

const monthKey = (year: number, month: number) =>
    `${year}-${String(month).padStart(2, '0')}`;

// Card shown on the history page: a compact year × month grid of the
// worker's monthly record confirmation states. Pending months are clickable
// and reuse the same confirmation flow as the check-in page banner.
export default function MonthlyConfirmationCard({
    onApproved,
}: MonthlyConfirmationCardProps) {
    const { t, lang } = useI18n();
    const locale = localeTag(lang);
    const [approvals, setApprovals] = useState<MonthlyApprovalRow[]>([]);
    const [startKey, setStartKey] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const me = await apiClient.getCurrentUser();
                if (!me || cancelled) return;
                setStartKey(toLocalDateKey(me.trackingStartDate));
                const res = await apiClient.getMonthlyApprovals(me._id);
                if (!cancelled && res.data?.approvals) {
                    setApprovals(res.data.approvals);
                }
            } catch (err) {
                console.error('Failed to load monthly approvals:', err);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, []);

    const { fromYear, toYear } = useMemo(() => {
        const now = new Date();
        const startYear = startKey ? Number(startKey.slice(0, 4)) : now.getFullYear();
        return {
            fromYear: Math.min(startYear, now.getFullYear()),
            toYear: now.getFullYear(),
        };
    }, [startKey]);

    const byMonth = useMemo(() => {
        const map = new Map<string, MonthlyApprovalRow>();
        for (const row of approvals) map.set(monthKey(row.year, row.month), row);
        return map;
    }, [approvals]);

    const cellState = (year: number, month: number): MonthCellState => {
        const key = monthKey(year, month);
        const row = byMonth.get(key);
        if (row) {
            return row.status === APPROVAL_APPROVED
                ? 'confirmed'
                : 'pending';
        }
        const now = new Date();
        const currentKey = monthKey(now.getFullYear(), now.getMonth() + 1);
        if (!startKey || key < startKey.slice(0, 7) || key > currentKey) {
            return 'notApplicable';
        }
        return 'awaitingReview';
    };

    const formatPeriod = (year: number, month: number) =>
        new Intl.DateTimeFormat(locale, {
            month: 'long',
            year: 'numeric',
        }).format(new Date(year, month - 1, 1));

    const handleCellClick = async (year: number, month: number) => {
        if (busyId) return;
        const row = byMonth.get(monthKey(year, month));
        if (!row || row.status !== APPROVAL_PENDING) return;
        if (
            !window.confirm(
                `${t('monthlyApprovals.confirmApprove')} ${formatPeriod(year, month)}?`
            )
        )
            return;
        setBusyId(row._id);
        setError(null);
        try {
            const res = await apiClient.approveMonthlyRecord(row._id);
            if (res.error || !res.data) {
                setError(
                    t(`error.${res.error}`) || res.error || t('error.PostError')
                );
            } else {
                setApprovals((prev) =>
                    prev.map((a) =>
                        a._id === row._id
                            ? { ...a, status: APPROVAL_APPROVED }
                            : a
                    )
                );
                onApproved?.(row.userId, year, month);
            }
        } catch (err) {
            console.error('Failed to approve monthly record:', err);
            setError(t('error.PostError'));
        } finally {
            setBusyId(null);
        }
    };

    const cellTitle = (year: number, month: number, state: MonthCellState) => {
        const period = formatPeriod(year, month);
        switch (state) {
            case 'confirmed':
                return `${period}: ${t('history.confirmation.tooltipConfirmed')}`;
            case 'pending':
                return `${period}: ${t('history.confirmation.tooltipPending')}`;
            case 'awaitingReview':
                return `${period}: ${t('history.confirmation.tooltipAwaitingReview')}`;
            default:
                return `${period}: ${t('history.confirmation.tooltipNotApplicable')}`;
        }
    };

    const legend = [
        ['confirmed', 'legendConfirmed'],
        ['pending', 'legendPending'],
        ['awaitingReview', 'legendAwaitingReview'],
        ['notApplicable', 'legendNotApplicable'],
    ] as const;

    return (
        <Card className="p-5">
            <div className="mb-3 flex items-center gap-2">
                <h3 className="text-lg font-semibold">
                    {t('history.confirmation.title')}
                </h3>
            </div>

            {error && (
                <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                    {error}
                </div>
            )}

            <MonthYearGrid
                fromYear={fromYear}
                toYear={toYear}
                cellState={cellState}
                cellTitle={cellTitle}
                onCellClick={handleCellClick}
                locale={locale}
            />

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                {legend.map(([state, key]) => (
                    <span key={state} className="flex items-center gap-1.5">
                        <span
                            className={`inline-block h-3 w-3 rounded ${monthStateClasses[state]}`}
                        />
                        {t(`history.confirmation.${key}`)}
                    </span>
                ))}
            </div>
        </Card>
    );
}
