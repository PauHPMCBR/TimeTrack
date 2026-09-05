'use client';

import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import {
    MonthlyApprovalOpenResult,
    MonthlyApprovalRow,
    WorkSessionAnomaly,
} from '@/schemas/api';
import { User } from '@/types';
import { localeTag } from '@/lib/datetime';
import { useUnsavedChanges } from '@/lib/useUnsavedChanges';
import { useDirty } from '@/lib/useDirty';
import { usePersistedState } from '@/lib/usePersistedState';
import {
    ADMIN_APPROVALS_MONTH,
    ADMIN_APPROVALS_YEAR,
    ADMIN_APPROVALS_USER,
    ADMIN_APPROVALS_STATUS,
} from '@/lib/storage';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Label from '@/components/ui/Label';
import { Alert } from '@/components/ui/Alert';
import AdminBackButton from '@/components/AdminBackButton';
import {
    MIN_VALID_YEAR,
    MAX_VALID_YEAR,
    APPROVAL_PENDING,
    APPROVAL_APPROVED,
} from 'shared/src/lib/constants';
import { CheckCircle2, XCircle, Undo2 } from 'lucide-react';

type NotifiedEntry = { userId: string; userName?: string };

const namesOf = (entries: NotifiedEntry[]) =>
    entries.map((e) => e.userName ?? e.userId).join(', ');

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function AdminMonthlyApprovalsPage() {
    const { t, lang } = useI18n();

    const now = new Date();
    const defaultMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    const defaultYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const [year, setYear] = usePersistedState<number>(ADMIN_APPROVALS_YEAR, defaultYear);
    const [month, setMonth] = usePersistedState<number>(ADMIN_APPROVALS_MONTH, defaultMonth);
    const [approvals, setApprovals] = useState<MonthlyApprovalRow[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [opening, setOpening] = useState(false);
    const [revokingId, setRevokingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [openResult, setOpenResult] = useState<MonthlyApprovalOpenResult | null>(
        null
    );
    const [filterUserId, setFilterUserId] = usePersistedState<string>(
        ADMIN_APPROVALS_USER,
        'all'
    );
    const [filterStatus, setFilterStatus] = usePersistedState<string>(
        ADMIN_APPROVALS_STATUS,
        'all'
    );
    const { dirty, markDirty, resetDirty } = useDirty();

    useUnsavedChanges(dirty);

    const load = async () => {
        try {
            setLoading(true);
            const [res, resUsers] = await Promise.allSettled([
                apiClient.getAdminMonthlyApprovals(),
                apiClient.getCompanyUsers(),
            ]);
            if (res.status === 'rejected' || res.value.error) {
                const err =
                    res.status === 'rejected'
                        ? null
                        : res.value.error ?? null;
                setError(t(`error.${err}`) || err || t('error.GetError'));
            } else {
                setApprovals(res.value.data?.approvals ?? []);
                setError(null);
            }
            if (resUsers.status === 'fulfilled' && resUsers.value.data?.users) {
                setUsers(resUsers.value.data.users);
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

    const handleOpen = async (force: boolean = false) => {
        setOpening(true);
        setError(null);
        setOpenResult(null);
        try {
            const res = await apiClient.openMonthlyApprovals({
                year,
                month,
                force,
            });
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

    const filteredApprovals = useMemo(() => {
        return approvals
            .filter((a) => filterUserId === 'all' || a.userId === filterUserId)
            .filter(
                (a) =>
                    filterStatus === 'all' ||
                    (filterStatus === APPROVAL_PENDING &&
                        a.status === APPROVAL_PENDING) ||
                    (filterStatus === APPROVAL_APPROVED &&
                        a.status === APPROVAL_APPROVED)
            );
    }, [approvals, filterUserId, filterStatus]);

    const groupedApprovals = useMemo(() => {
        const sorted = [...filteredApprovals].sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year;
            if (a.month !== b.month) return b.month - a.month;
            if (a.status !== b.status)
                return a.status === APPROVAL_PENDING ? -1 : 1;
            return (a.userName ?? a.userId).localeCompare(b.userName ?? b.userId);
        });

        const groups: { key: string; year: number; month: number; rows: MonthlyApprovalRow[] }[] = [];
        for (const row of sorted) {
            const key = `${row.year}-${row.month}`;
            const last = groups[groups.length - 1];
            if (last && last.key === key) {
                last.rows.push(row);
            } else {
                groups.push({ key, year: row.year, month: row.month, rows: [row] });
            }
        }
        return groups;
    }, [filteredApprovals]);

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

            {error && <Alert variant="destructive">{error}</Alert>}

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
                                    {new Intl.DateTimeFormat(localeTag(lang), {
                                        month: 'long',
                                    }).format(new Date(2000, m - 1, 1))}
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
                        onClick={() => handleOpen(false)}
                    >
                        {opening
                            ? t('common.loading')
                            : t('monthlyApprovals.openAction')}
                    </Button>
                    <Button
                        variant="danger"
                        disabled={opening}
                        onClick={() => {
                            if (
                                window.confirm(
                                    t('monthlyApprovals.forceConfirm')
                                )
                            ) {
                                handleOpen(true);
                            }
                        }}
                    >
                        {t('monthlyApprovals.forceAction')}
                    </Button>
                </div>

                {openResult && (
                    <div className="mt-4 space-y-3">
                        {openResult.notified.length === 0 &&
                            openResult.emailFailed.length === 0 &&
                            openResult.blocked.length === 0 &&
                            openResult.skipped.length === 0 &&
                            openResult.notTracking.length === 0 && (
                                <Alert
                                    variant="warning"
                                    title={t(
                                        'monthlyApprovals.notifiedNoneTitle'
                                    )}
                                />
                            )}
                        {openResult.notified.length > 0 && (
                            <Alert variant="success">
                                <span className="font-semibold">
                                    {t('monthlyApprovals.notifiedTitle').replace(
                                        '{count}',
                                        String(openResult.notified.length)
                                    )}{' '}
                                </span>
                                {namesOf(openResult.notified)}
                            </Alert>
                        )}
                        {openResult.emailFailed.length > 0 && (
                            <Alert variant="destructive">
                                <span className="font-semibold">
                                    {t('monthlyApprovals.emailFailedTitle').replace(
                                        '{count}',
                                        String(openResult.emailFailed.length)
                                    )}{' '}
                                </span>
                                {namesOf(openResult.emailFailed)}
                                <span className="mt-1 block text-xs">
                                    {t('monthlyApprovals.emailFailedNote')}
                                </span>
                            </Alert>
                        )}
                        {openResult.blocked.length > 0 && (
                            <Alert variant="warning">
                                <span className="font-semibold">
                                    {t('monthlyApprovals.blockedTitle')}{' '}
                                </span>
                                {openResult.blocked
                                    .map(
                                        (b) =>
                                            `${b.userName ?? b.userId} (${b.anomalies
                                                .map(anomalyLabel)
                                                .join(', ')})`
                                    )
                                    .join(', ')}
                            </Alert>
                        )}
                        {openResult.skipped.length > 0 && (
                            <Alert variant="default">
                                <span className="font-semibold">
                                    {t('monthlyApprovals.skippedTitle')}{' '}
                                </span>
                                {namesOf(openResult.skipped)}
                            </Alert>
                        )}
                        {openResult.notTracking.length > 0 && (
                            <Alert variant="default">
                                <span className="font-semibold">
                                    {t('monthlyApprovals.notTrackingTitle')}{' '}
                                </span>
                                {namesOf(openResult.notTracking)}
                            </Alert>
                        )}
                    </div>
                )}
            </Card>

            <Card className="p-6">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                    <h2 className="text-lg font-semibold">
                        {t('monthlyApprovals.registryTitle')}
                    </h2>
                    <div className="flex flex-wrap items-end gap-3">
                        <div>
                            <Label className="mb-1.5">
                                {t('monthlyApprovals.filterEmployees')}
                            </Label>
                            <select
                                value={filterUserId}
                                onChange={(e) => setFilterUserId(e.target.value)}
                                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                            >
                                <option value="all">
                                    {t('monthlyApprovals.filterAllEmployees')}
                                </option>
                                {users.map((u) => (
                                    <option key={u._id} value={u._id}>
                                        {u.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <Label className="mb-1.5">
                                {t('monthlyApprovals.filterState')}
                            </Label>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                            >
                                <option value="all">
                                    {t('monthlyApprovals.filterAllStates')}
                                </option>
                                <option value={APPROVAL_PENDING}>
                                    {t('monthlyApprovals.statusPending')}
                                </option>
                                <option value={APPROVAL_APPROVED}>
                                    {t('monthlyApprovals.statusApproved')}
                                </option>
                            </select>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="p-6 text-center animate-pulse text-zinc-500">
                        {t('common.loading')}
                    </div>
                ) : approvals.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                        {t('monthlyApprovals.empty')}
                    </p>
                ) : groupedApprovals.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                        {t('monthlyApprovals.filterNoMatch')}
                    </p>
                ) : (
                    <div className="space-y-4">
                        {groupedApprovals.map((group) => (
                            <div key={group.key}>
                                <div className="mb-2 border-b border-zinc-200 pb-1 text-sm font-semibold text-zinc-700 capitalize dark:border-zinc-700 dark:text-zinc-200">
                                    {formatPeriod(group.year, group.month)}
                                </div>
                                <div className="space-y-2">
                                    {group.rows.map((row) => (
                                        <div
                                            key={row._id}
                                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
                                        >
                                            <div>
                                                <p className="text-sm font-medium">
                                                    {row.userName ?? row.userId}
                                                    <span className="ml-2 font-normal text-zinc-500 capitalize">
                                                        {formatPeriod(
                                                            row.year,
                                                            row.month
                                                        )}
                                                    </span>
                                                </p>
                                                <p className="mt-0.5 text-xs text-zinc-500">
                                                    {t('monthlyApprovals.requestedAt')}:{' '}
                                                    {formatDate(row.requestedAt)}
                                                    {row.status ===
                                                        'approved' && (
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
                                                    <Undo2
                                                        size={14}
                                                        className="mr-1.5 inline"
                                                    />
                                                    {t('monthlyApprovals.revoke')}
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
}
