'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import { AdminWorkSessionRow } from '@/types';
import { localeTag, toLocalDateKey } from '@/lib/datetime';
import { toCsv, downloadCsv } from '@/lib/csv';
import { Download } from 'lucide-react';
import Button from '@/components/ui/Button';
import FitxatgesTable from '@/components/FitxatgesTable';
import WorkSessionsToolbar from '@/components/WorkSessionsToolbar';
import MonthlyConfirmationCard from '@/components/MonthlyConfirmationCard';
import { usePersistedState } from '@/lib/usePersistedState';
import {
    AdminReportPeriod,
} from 'shared/src/lib/constants';
import {
    HISTORY_PERIOD,
    HISTORY_CURSOR,
    HISTORY_ANOMALY_ONLY,
} from '@/lib/storage';

type Period = AdminReportPeriod;

export default function HistoryPage() {
    const { t, lang } = useI18n();
    const locale = localeTag(lang);

    const [period, setPeriod] = usePersistedState<Period>(HISTORY_PERIOD, 'week');
    const [cursor, setCursor] = usePersistedState<Date>(
        HISTORY_CURSOR,
        () => {
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            return now;
        },
        {
            serialize: (d) => d.toISOString(),
            deserialize: (s) => {
                const d = new Date(s);
                d.setHours(0, 0, 0, 0);
                return d;
            },
        }
    );
    const [rows, setRows] = useState<AdminWorkSessionRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [approvedMonths, setApprovedMonths] = useState<Set<string>>(
        new Set()
    );
    const [anomalyOnly, setAnomalyOnly] = usePersistedState<boolean>(
        HISTORY_ANOMALY_ONLY,
        false
    );
    const PAGE_SIZE = 200;

    const loadRows = useCallback(async () => {
        setLoading(true);
        setError(null);
        let params: Parameters<typeof apiClient.getMyWorkSessions>[0];
        if (period === 'day' || period === 'week') {
            params = {
                period,
                date: toLocalDateKey(cursor),
                limit: PAGE_SIZE,
                offset,
            };
        } else if (period === 'month') {
            params = {
                period,
                year: cursor.getFullYear(),
                month: cursor.getMonth() + 1,
                limit: PAGE_SIZE,
                offset,
            };
        } else {
            params = {
                period,
                year: cursor.getFullYear(),
                limit: PAGE_SIZE,
                offset,
            };
        }

        const res = await apiClient.getMyWorkSessions(params);
        if (res.error) {
            setError(
                t(`error.${res.error}`) || res.error || t('error.GetError')
            );
            setRows([]);
            setTotal(0);
        } else if (res.data?.rows) {
            setRows(res.data.rows);
            setTotal(res.data.total ?? res.data.rows.length);
            setApprovedMonths(
                new Set(res.data.approvedMonths ?? [])
            );
        }
        setLoading(false);
    }, [period, cursor, offset, t]);

    useEffect(() => {
        loadRows();
    }, [loadRows]);

    const shiftCursor = (dir: -1 | 1) => {
        setOffset(0);
        const next = new Date(cursor);
        if (period === 'day') next.setDate(next.getDate() + dir);
        else if (period === 'week') next.setDate(next.getDate() + 7 * dir);
        else if (period === 'month') next.setMonth(next.getMonth() + dir);
        else next.setFullYear(next.getFullYear() + dir);
        setCursor(next);
    };

    const periodLabel = () => {
        if (period === 'month') {
            const label = cursor.toLocaleDateString(locale, {
                month: 'long',
                year: 'numeric',
            });
            return label.charAt(0).toUpperCase() + label.slice(1);
        }
        if (period === 'year') return String(cursor.getFullYear());
        const start = cursor.toLocaleDateString(locale, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
        if (period === 'day') return start;
        const end = new Date(cursor);
        end.setDate(end.getDate() + 6);
        const endLabel = end.toLocaleDateString(locale, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
        return `${start} — ${endLabel}`;
    };

    const changePeriod = (p: Period) => {
        setOffset(0);
        setPeriod(p);
    };

    const handleExport = useCallback(() => {
        const headers = [
            t('history.export.date'),
            t('history.export.hours'),
            t('history.export.status'),
            t('history.export.confirmed'),
        ];
        const dayRows = (anomalyOnly
            ? rows.filter((r) => r.status === 'anomaly')
            : rows
        ).map((r) => {
            const monthKey = r.date.slice(0, 7);
            const userMonthKey = `${r.userId}:${monthKey}`;
            const isConfirmed = approvedMonths?.has(userMonthKey) ?? false;
            return [
                r.date,
                r.totalHours.toFixed(2),
                t(`admin.events.status.${r.status}`),
                isConfirmed ? t('common.yes') : t('common.no'),
            ];
        });
        downloadCsv(
            toCsv(headers, dayRows),
            `history_${period}_${toLocalDateKey(new Date())}.csv`
        );
    }, [rows, anomalyOnly, t, period, approvedMonths]);

    return (
        <section className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                    {t('tabs.history')}
                </h2>
                <Button variant="soft" onClick={handleExport}>
                    <Download size={16} />
                    {t('history.export.label')}
                </Button>
            </div>

            {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                    {error}
                </div>
            )}

            <WorkSessionsToolbar
                period={period}
                onPeriodChange={changePeriod}
                cursor={cursor}
                onCursorChange={(d) => {
                    setOffset(0);
                    setCursor(d);
                }}
                onShift={shiftCursor}
                anomalyOnly={anomalyOnly}
                onAnomalyOnlyChange={setAnomalyOnly}
                periodLabel={periodLabel()}
            />

            <FitxatgesTable
                rows={rows}
                loading={loading}
                anomalyOnly={anomalyOnly}
                total={total}
                offset={offset}
                pageSize={PAGE_SIZE}
                onPageChange={setOffset}
                approvedMonths={approvedMonths}
            />

            <hr></hr>

            <MonthlyConfirmationCard
                onApproved={(userId, year, month) =>
                    setApprovedMonths((prev) => {
                        const next = new Set(prev);
                        next.add(
                            `${userId}:${year}-${String(month).padStart(2, '0')}`
                        );
                        return next;
                    })
                }
            />
        </section>
    );
}
