'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import { MonthlyApprovalRow, WorkSessionAnomaly } from '@/schemas/api';
import { localeTag } from '@/lib/datetime';
import { useUnsavedChanges } from '@/lib/useUnsavedChanges';
import { useDirty } from '@/lib/useDirty';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Label from '@/components/ui/Label';
import AdminBackButton from '@/components/AdminBackButton';
import { MIN_VALID_YEAR, MAX_VALID_YEAR } from 'shared/src/lib/constants';
import { CheckCircle2, XCircle, Undo2 } from 'lucide-react';

type OpenResult = {
    opened: MonthlyApprovalRow[];
    blocked: { userId: string; userName?: string; anomalies: WorkSessionAnomaly[] }[];
};

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function AdminMonthlyApprovalsPage() {
    const { t, lang } = useI18n();

    const now = new Date();
    const [year, setYear] = useState(
        now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
    );
    const [month, setMonth] = useState(
        now.getMonth() === 0 ? 12 : now.getMonth()
    );
    const [approvals, setApprovals] = useState<MonthlyApprovalRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [opening, setOpening] = useState(false);
    const [revokingId, setRevokingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [openResult, setOpenResult] = useState<OpenResult | null>(null);
    const { dirty, markDirty, resetDirty } = useDirty();

    useUnsavedChanges(dirty);

    const load = async () => {
        try {
            setLoading(true);
            const res = await apiClient.getAdminMonthlyApprovals();
            if (res.error) {
                setError(t(`error.${res.error}`) || res.error || t('error.GetError'));
            } else {
                setApprovals(res.data?.approvals ?? []);
                setError(null);
            }
        } catch (err) {
            console.error('Failed to load monthly approvals:', err);
            setError(t('error.GetError'));
        } finally {
            resetDirty();
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const formatPeriod = (year: number, month: number) =>
        new Intl.DateTimeFormat(localeTag(lang), {
            month: 'long',
            year: 'numeric',
        }).format(new Date(year, month - 1, 1));

    const formatDate = (value?: string | Date | null) =>
        value
            ? new Date(value).toLocaleDateString(localeTag(lang), {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
              })
            : '—';

    const handleOpen = async () => {
        setOpening(true);
        setError(null);
        setOpenResult(null);
        try {
            const res = await apiClient.openMonthlyApprovals({ year, month });
            if (res.error || !res.data) {
                setError(
                    t(`error.${res.error}`) || res.error || t('error.PostError')
                );
            } else {
                setOpenResult(res.data);
                await load();
            }
        } catch (err) {
            console.error('Failed to open monthly approvals:', err);
            setError(t('error.PostError'));
        } finally {
            setOpening(false);
        }
    };

    const handleRevoke = async (row: MonthlyApprovalRow) => {
        if (
            !window.confirm(
                `${t('monthlyApprovals.confirmRevoke')} ${row.userName ?? ''} — ${formatPeriod(row.year, row.month)}?`
            )
        )
            return;
        setRevokingId(row._id);
        setError(null);
        try {
            const res = await apiClient.revokeMonthlyApproval({
                userId: row.userId,
                year: row.year,
                month: row.month,
            });
            if (res.error) {
                setError(t(`error.${res.error}`) || res.error || t('error.PostError'));
            } else {
                setApprovals((prev) => prev.filter((a) => a._id !== row._id));
            }
        } catch (err) {
            console.error('Failed to revoke monthly approval:', err);
            setError(t('error.PostError'));
        } finally {
            setRevokingId(null);
        }
    };

    const anomalyLabel = (a: WorkSessionAnomaly) =>
        t(`monthlyApprovals.anomaly.${a}`);

    return (
        <div className="space-y-6">
            <AdminBackButton />

            <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                    {t('monthlyApprovals.adminTitle')}
                </h1>
                <p className="mt-1 text-sm text-zinc-500">
                    {t('monthlyApprovals.adminSubtitle')}
                </p>
            </div>

            {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                    {error}
                </div>
            )}

            <Card className="p-6">
                <h2 className="mb-3 text-lg font-semibold">
                    {t('monthlyApprovals.openTitle')}
                </h2>
                <p className="mb-4 text-sm text-zinc-500">
                    {t('monthlyApprovals.openDesc')}
                </p>
                <div className="flex flex-wrap items-end gap-3">
                    <div>
                        <Label className="mb-1.5">{t('monthlyApprovals.month')}</Label>
                        <select
                            value={month}
                            onChange={(e) => {
                                setMonth(Number(e.target.value));
                                markDirty();
                            }}
                            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                        >
                            {MONTHS.map((m) => (
                                <option key={m} value={m}>
                                    <span className="capitalize">
                                        {new Intl.DateTimeFormat(localeTag(lang), {
                                            month: 'long',
                                        }).format(new Date(2000, m - 1, 1))}
                                    </span>
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <Label className="mb-1.5">{t('monthlyApprovals.year')}</Label>
                        <input
                            type="number"
                            min={MIN_VALID_YEAR}
                            max={MAX_VALID_YEAR}
                            value={year}
                            onChange={(e) => {
                                setYear(Number(e.target.value));
                                markDirty();
                            }}
                            className="w-28 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                        />
                    </div>
                    <Button
                        variant="primary"
                        disabled={opening}
                        onClick={handleOpen}
                    >
                        {opening
                            ? t('common.loading')
                            : t('monthlyApprovals.openAction')}
                    </Button>
                </div>

                {openResult && (
                    <div className="mt-4 space-y-2 text-sm">
                        <p className="font-medium text-green-600 dark:text-green-400">
                            {t('monthlyApprovals.openedCount').replace(
                                '{count}',
                                String(openResult.opened.length)
                            )}
                        </p>
                        {openResult.blocked.length > 0 && (
                            <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
                                <p className="mb-1 font-medium text-amber-700 dark:text-amber-300">
                                    {t('monthlyApprovals.blockedTitle')}
                                </p>
                                <ul className="list-disc pl-4 space-y-1 text-zinc-600 dark:text-zinc-300">
                                    {openResult.blocked.map((b) => (
                                        <li key={b.userId}>
                                            {b.userName ?? b.userId}:{' '}
                                            {b.anomalies.map(anomalyLabel).join(', ')}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </Card>

            <Card className="p-6">
                <h2 className="mb-3 text-lg font-semibold">
                    {t('monthlyApprovals.registryTitle')}
                </h2>
                {loading ? (
                    <div className="p-6 text-center animate-pulse text-zinc-500">
                        {t('common.loading')}
                    </div>
                ) : approvals.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                        {t('monthlyApprovals.empty')}
                    </p>
                ) : (
                    <div className="space-y-2">
                        {approvals.map((row) => (
                            <div
                                key={row._id}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
                            >
                                <div>
                                    <p className="text-sm font-medium">
                                        {row.userName ?? row.userId}
                                        <span className="ml-2 font-normal text-zinc-500 capitalize">
                                            {formatPeriod(row.year, row.month)}
                                        </span>
                                    </p>
                                    <p className="mt-0.5 text-xs text-zinc-500">
                                        {t('monthlyApprovals.requestedAt')}:{' '}
                                        {formatDate(row.requestedAt)}
                                        {row.status === 'approved' && (
                                            <>
                                                {' · '}
                                                {t('monthlyApprovals.approvedAt')}:{' '}
                                                {formatDate(row.approvedAt)}
                                            </>
                                        )}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    {row.status === 'approved' ? (
                                        <span className="flex items-center gap-1.5 text-sm font-medium text-green-600 dark:text-green-400">
                                            <CheckCircle2 size={16} />
                                            {t('monthlyApprovals.statusApproved')}
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1.5 text-sm font-medium text-amber-600 dark:text-amber-400">
                                            <XCircle size={16} />
                                            {t('monthlyApprovals.statusPending')}
                                        </span>
                                    )}
                                    <Button
                                        variant="secondary"
                                        disabled={revokingId === row._id}
                                        onClick={() => handleRevoke(row)}
                                    >
                                        <Undo2 size={14} className="mr-1.5 inline" />
                                        {t('monthlyApprovals.revoke')}
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
}
