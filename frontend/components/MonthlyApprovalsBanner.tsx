'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import { localeTag } from '@/lib/datetime';
import { MonthlyApprovalRow } from '@/schemas/api';
import { APPROVAL_PENDING } from 'shared/src/lib/constants';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { ShieldCheck } from 'lucide-react';

// Banner shown on the check-in page: months the administration has reviewed
// and opened for the worker's confirmation (registro de jornada monthly
// record). Confirming is the worker's signature on the month's record.
export default function MonthlyApprovalsBanner() {
    const { t, lang } = useI18n();
    const [pending, setPending] = useState<MonthlyApprovalRow[]>([]);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const me = await apiClient.getCurrentUser();
                if (!me) return;
                const res = await apiClient.getMonthlyApprovals(me._id);
                if (!cancelled && res.data?.approvals) {
                    setPending(
                        res.data.approvals.filter(
                            (a) => a.status === APPROVAL_PENDING
                        )
                    );
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

    if (pending.length === 0) return null;

    const formatPeriod = (year: number, month: number) =>
        new Intl.DateTimeFormat(localeTag(lang), {
            month: 'long',
            year: 'numeric',
        }).format(new Date(year, month - 1, 1));

    const handleApprove = async (row: MonthlyApprovalRow) => {
        if (
            !window.confirm(
                `${t('monthlyApprovals.confirmApprove')} ${formatPeriod(row.year, row.month)}?`
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
                setPending((prev) => prev.filter((p) => p._id !== row._id));
            }
        } catch (err) {
            console.error('Failed to approve monthly record:', err);
            setError(t('error.PostError'));
        } finally {
            setBusyId(null);
        }
    };

    return (
        <Card className="border-amber-300 bg-amber-50 p-5 dark:border-amber-700 dark:bg-amber-900/20">
            <div className="mb-2 flex items-center gap-2">
                <ShieldCheck
                    size={20}
                    className="text-amber-600 dark:text-amber-400"
                />
                <h2 className="text-lg font-semibold">
                    {t('monthlyApprovals.bannerTitle')}
                </h2>
            </div>
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                {t('monthlyApprovals.bannerDesc')}
            </p>

            {error && (
                <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                    {error}
                </div>
            )}

            <div className="space-y-2">
                {pending.map((row) => (
                    <div
                        key={row._id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
                    >
                        <span className="text-sm font-medium capitalize">
                            {formatPeriod(row.year, row.month)}
                        </span>
                        <Button
                            variant="primary"
                            disabled={busyId === row._id}
                            onClick={() => handleApprove(row)}
                        >
                            {t('monthlyApprovals.approve')}
                        </Button>
                    </div>
                ))}
            </div>

            <p className="mt-3 text-xs text-zinc-500">
                {t('monthlyApprovals.bannerNote')}
            </p>
        </Card>
    );
}
