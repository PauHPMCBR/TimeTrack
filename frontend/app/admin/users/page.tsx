'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import { ADMIN_ROLE } from 'shared/src/lib/constants';
import { User } from '@/types';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import {
    UserPlus,
    Download,
    Pencil,
    Timer,
    Users,
    TriangleAlert,
} from 'lucide-react';
import AdminBackButton from '../../../components/AdminBackButton';
import Avatar from '@/components/Avatar';
import UserEditModal from '../../../components/UserEditModal';
import UserCreateModal from '../../../components/UserCreateModal';

type DashboardUser = User & { workingNow?: boolean };

export default function UsersListPage() {
    const { t } = useI18n();

    const [users, setUsers] = useState<DashboardUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [exporting, setExporting] = useState(false);
    const [exportError, setExportError] = useState<string | null>(null);
    const [exportFrom, setExportFrom] = useState('');
    const [exportTo, setExportTo] = useState('');
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [creating, setCreating] = useState(false);
    const [total, setTotal] = useState(0);
    const [workingNow, setWorkingNow] = useState(0);

    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);
            const res = await apiClient.getAdminDashboard();
            if (res.data?.users) {
                setUsers(res.data.users);
                setTotal(res.data.usersCount ?? res.data.users.length);
                setWorkingNow(res.data.currentlyWorking ?? 0);
            }
        } catch (error) {
            console.error('Error carregant usuaris:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const allSelected = useMemo(
        () => users.length > 0 && selected.size === users.length,
        [users, selected]
    );

    const toggleUser = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (allSelected) setSelected(new Set());
        else setSelected(new Set(users.map((u) => u._id)));
    };

    const handleExport = async () => {
        if (selected.size === 0) return;
        setExporting(true);
        setExportError(null);
        const res = await apiClient.exportWorkSessions([...selected], {
            from: exportFrom || undefined,
            to: exportTo || undefined,
        });
        setExporting(false);
        if (res.error) setExportError(res.error);
    };

    return (
        <div className="space-y-6">
            <AdminBackButton />

            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                        {t('admin.menu.users.title')}
                    </h1>
                    <p className="mt-1 flex items-center gap-4 text-sm text-zinc-500">
                        <span className="flex items-center gap-1">
                            <Users size={14} />
                            {loading ? '-' : total}{' '}
                            {t('admin.menu.users.total')}
                        </span>
                        <span className="flex items-center gap-1">
                            <Timer size={14} />
                            {loading ? '-' : workingNow}{' '}
                            {t('admin.menu.users.working')}
                        </span>
                    </p>
                </div>
                <Button variant="primary" onClick={() => setCreating(true)}>
                    <UserPlus size={16} />
                    {t('admin.dashboard.addUser')}
                </Button>
            </div>

            <div className="flex items-center justify-between gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                    <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    {t('admin.export.selectAll')}
                </label>
                <div className="flex items-center gap-3">
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                        {t('admin.export.selectedCount', {
                            count: selected.size,
                        })}
                    </span>
                    <span className="mx-1 h-4 w-px bg-zinc-300 dark:bg-zinc-700"></span>
                    <label className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm text-zinc-600 dark:text-zinc-300">
                        {t('admin.export.from')}
                        <input
                            type="date"
                            value={exportFrom}
                            max={exportTo || undefined}
                            onChange={(e) => setExportFrom(e.target.value)}
                            className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                        />
                    </label>
                    <label className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm text-zinc-600 dark:text-zinc-300">
                        {t('admin.export.to')}
                        <input
                            type="date"
                            value={exportTo}
                            min={exportFrom || undefined}
                            onChange={(e) => setExportTo(e.target.value)}
                            className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                        />
                    </label>
                    <Button
                        onClick={handleExport}
                        disabled={selected.size === 0 || exporting}
                        variant="soft"
                    >
                        <Download size={16} />
                        {exporting
                            ? t('common.loading')
                            : t('admin.export.button')}
                    </Button>
                </div>
            </div>

            {exportError && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                    {t('admin.export.error')} ({exportError})
                </div>
            )}

            <Card className="overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-sm text-zinc-500 animate-pulse">
                        {t('common.loading')}
                    </div>
                ) : (
                    <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {users.length === 0 && (
                            <div className="p-8 text-center text-sm text-zinc-500">
                                {t('admin.users.notFound')}
                            </div>
                        )}
                        {users.map((user) => (
                            <li
                                key={user._id}
                                className="flex items-center justify-between p-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                            >
                                <div className="flex items-center gap-4">
                                    <input
                                        type="checkbox"
                                        checked={selected.has(user._id)}
                                        onChange={() => toggleUser(user._id)}
                                        className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <Avatar
                                        userId={user._id}
                                        version={user.avatar ?? null}
                                        alt={
                                            user.name ||
                                            t('admin.users.noName')
                                        }
                                        fallback={
                                            user.name
                                                ? user.name
                                                      .charAt(0)
                                                      .toUpperCase()
                                                : '?'
                                        }
                                        className="h-10 w-10 rounded-full object-cover"
                                        fallbackClassName="h-10 w-10 rounded-full bg-indigo-100 text-sm text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
                                    />
                                    <div>
                                        <div className="font-medium text-zinc-900 dark:text-white">
                                            {user.name ||
                                                t('admin.users.noName')}
                                            {user.workDays &&
                                                user.workDays.length > 0 && (
                                                    <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                                        <TriangleAlert
                                                            size={12}
                                                        />
                                                        {t(
                                                            'admin.users.customNonWorkDays'
                                                        )}
                                                    </span>
                                                )}
                                            {user.role === ADMIN_ROLE && (
                                                <span className="ml-2 inline-flex items-center rounded-md bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                                                    {t('tabs.admin')}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-zinc-500">
                                            {user.email}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {user.blocked ? (
                                        <div
                                            title={t('admin.users.unblockHint')}
                                            className="flex items-center gap-2 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/20"
                                        >
                                            <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>
                                            {t('admin.users.blocked')}
                                        </div>
                                    ) : user.workingNow ? (
                                        <div className="flex items-center gap-2 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/20">
                                            <span className="relative flex h-1.5 w-1.5">
                                                <span className="absolute inline-flex h-1.5 w-1.5 animate-ping rounded-full bg-green-500 opacity-75"></span>
                                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500"></span>
                                            </span>
                                            {t('admin.users.workingNow')}
                                        </div>
                                    ) : user.registered ? (
                                        <div className="flex items-center gap-2 rounded-full bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-600 ring-1 ring-inset ring-zinc-500/10 dark:bg-zinc-400/10 dark:text-zinc-400 dark:ring-zinc-400/20">
                                            <span className="h-1.5 w-1.5 rounded-full bg-zinc-400"></span>
                                            {t('admin.users.registered')}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20">
                                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
                                            {t('admin.users.pendingActivation')}
                                        </div>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setEditingUser(user)}
                                        className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition-colors"
                                        aria-label={t(
                                            'admin.usersEdit.editAction'
                                        )}
                                    >
                                        <Pencil size={16} />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            <UserEditModal
                user={editingUser}
                open={!!editingUser}
                onClose={() => setEditingUser(null)}
                onSaved={fetchUsers}
            />

            <UserCreateModal
                open={creating}
                onClose={() => setCreating(false)}
                onCreated={fetchUsers}
            />
        </div>
    );
}
