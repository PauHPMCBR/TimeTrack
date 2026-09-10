'use client';

import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import { AuditEventRow } from '@/schemas/api';
import { User } from '@/types';
import { localeTag } from '@/lib/datetime';
import { AUDIT_ACTIONS } from 'shared/src/lib/constants';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Label from '@/components/ui/Label';
import { Alert } from '@/components/ui/Alert';
import AdminBackButton from '@/components/AdminBackButton';
import { ChevronLeft, ChevronRight, ScrollText } from 'lucide-react';

const PAGE_SIZE = 50;

// Read-only review of the append-only audit log (logins, exports, admin
// edits). Newest first; filterable by action, user and date range, with
// server-side pagination. There is deliberately no way to edit or delete
// entries from here.
export default function AdminAuditPage() {
    const { t, lang } = useI18n();
    const locale = localeTag(lang);

    const [events, setEvents] = useState<AuditEventRow[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [actionFilter, setActionFilter] = useState('all');
    const [userFilter, setUserFilter] = useState('all');
    const [fromFilter, setFromFilter] = useState('');
    const [toFilter, setToFilter] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiClient.getAuditEvents({
                limit: PAGE_SIZE,
                offset,
                action: actionFilter === 'all' ? undefined : actionFilter,
                actorId: userFilter === 'all' ? undefined : userFilter,
                from: fromFilter || undefined,
                to: toFilter || undefined,
            });
            if (res.error || !res.data) {
                setError(
                    t(`error.${res.error}`) || res.error || t('error.GetError')
                );
            } else {
                setEvents(res.data.events);
                setTotal(res.data.total ?? res.data.events.length);
            }
        } catch (err) {
            console.error('Failed to load audit events:', err);
            setError(t('error.GetError'));
        } finally {
            setLoading(false);
        }
    }, [offset, actionFilter, userFilter, fromFilter, toFilter, t]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        let cancelled = false;
        apiClient.getCompanyUsers().then((res) => {
            if (!cancelled && res.data) setUsers(res.data.users);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const changeFilter = (apply: () => void) => {
        setOffset(0);
        apply();
    };

    const formatDateTime = (value?: string | Date | null) =>
        value
            ? new Date(value).toLocaleString(locale, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
              })
            : '—';

    const actionLabel = (action: string) => {
        const key = `admin.audit.action.${action}`;
        const text = t(key);
        return text !== key ? text : action;
    };

    const selectClass =
        'rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800';
    const dateInputClass =
        'rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:[color-scheme:dark]';

    return (
        <div className="space-y-6">
            <AdminBackButton />

            <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                    {t('admin.audit.title')}
                </h1>
                <p className="mt-1 text-sm text-zinc-500">
                    {t('admin.audit.subtitle')}
                </p>
            </div>

            {error && <Alert variant="destructive">{error}</Alert>}

            <Card className="p-6">
                <div className="mb-4 flex flex-wrap items-end gap-3">
                    <div>
                        <Label className="mb-1.5">
                            {t('admin.audit.filterAction')}
                        </Label>
                        <select
                            value={actionFilter}
                            onChange={(e) =>
                                changeFilter(() => setActionFilter(e.target.value))
                            }
                            className={selectClass}
                        >
                            <option value="all">
                                {t('admin.audit.filterAll')}
                            </option>
                            {Object.values(AUDIT_ACTIONS).map((action) => (
                                <option key={action} value={action}>
                                    {actionLabel(action)}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <Label className="mb-1.5">
                            {t('admin.audit.filterUser')}
                        </Label>
                        <select
                            value={userFilter}
                            onChange={(e) =>
                                changeFilter(() => setUserFilter(e.target.value))
                            }
                            className={selectClass}
                        >
                            <option value="all">
                                {t('admin.audit.filterAllUsers')}
                            </option>
                            {users.map((user) => (
                                <option key={user._id} value={user._id}>
                                    {user.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <Label className="mb-1.5">
                            {t('admin.audit.filterFrom')}
                        </Label>
                        <input
                            type="date"
                            value={fromFilter}
                            onChange={(e) =>
                                changeFilter(() => setFromFilter(e.target.value))
                            }
                            className={dateInputClass}
                        />
                    </div>
                    <div>
                        <Label className="mb-1.5">
                            {t('admin.audit.filterTo')}
                        </Label>
                        <input
                            type="date"
                            value={toFilter}
                            onChange={(e) =>
                                changeFilter(() => setToFilter(e.target.value))
                            }
                            className={dateInputClass}
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="p-6 text-center animate-pulse text-zinc-500">
                        {t('common.loading')}
                    </div>
                ) : events.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                        {t('admin.audit.empty')}
                    </p>
                ) : (
                    <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {events.map((event) => (
                            <li
                                key={event._id}
                                className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                            >
                                <div className="flex min-w-0 items-center gap-2">
                                    <ScrollText
                                        size={14}
                                        className="shrink-0 text-zinc-400"
                                    />
                                    <span className="font-medium">
                                        {actionLabel(event.action)}
                                    </span>
                                    <span className="truncate text-zinc-500">
                                        {event.actorName ?? '—'}
                                        {event.targetId
                                            ? ` · ${event.targetId}`
                                            : ''}
                                        {event.ip
                                            ? ` · ${event.ip}`
                                            : ''}
                                    </span>
                                </div>
                                <span className="shrink-0 text-xs text-zinc-500">
                                    {formatDateTime(event.timestamp)}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}

                {total > PAGE_SIZE && (
                    <div className="mt-4 flex items-center justify-between gap-3">
                        <span className="text-sm text-zinc-500 dark:text-zinc-400">
                            {offset + 1}–
                            {Math.min(offset + PAGE_SIZE, total)} / {total}
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="secondary"
                                onClick={() =>
                                    setOffset(Math.max(0, offset - PAGE_SIZE))
                                }
                                disabled={offset === 0}
                            >
                                <ChevronLeft size={14} />
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={() => setOffset(offset + PAGE_SIZE)}
                                disabled={offset + PAGE_SIZE >= total}
                            >
                                <ChevronRight size={14} />
                            </Button>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
}
