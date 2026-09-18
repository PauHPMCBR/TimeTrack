'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import type { AuthorizedLeaveRow } from '@/schemas/api';
import type { User } from '@/types';
import type { DateKey } from 'shared/src/lib/day-key';
import { Alert } from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import LoadingState from '@/components/ui/LoadingState';
import Modal from '@/components/Modal';
import AdminBackButton from '@/components/AdminBackButton';
import { useDirty } from '@/lib/useDirty';
import { Plus, Pencil, Trash2, ShieldCheck } from 'lucide-react';

const inputClass =
    'w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:text-white';

export default function AdminAuthorizedLeavesPage() {
    const { t } = useI18n();

    const [leaves, setLeaves] = useState<AuthorizedLeaveRow[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filterUserId, setFilterUserId] = useState<string>('all');
    const [modalUser, setModalUser] = useState<string>('');
    const [modalFrom, setModalFrom] = useState('');
    const [modalTo, setModalTo] = useState('');
    const [modalNotes, setModalNotes] = useState('');
    const [editing, setEditing] = useState<AuthorizedLeaveRow | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const fetchSeq = useRef(0);
    const { dirty, markDirty, resetDirty } = useDirty();

    const fetchLeaves = useCallback(async () => {
        const seq = ++fetchSeq.current;
        setLoading(true);
        setError(null);
        try {
            const [resLeaves, resUsers] = await Promise.allSettled([
                apiClient.getAuthorizedLeaves({
                    userId:
                        filterUserId === 'all' ? undefined : filterUserId,
                }),
                apiClient.getCompanyUsers(),
            ]);
            if (seq !== fetchSeq.current) return;

            if (
                resLeaves.status === 'fulfilled' &&
                resLeaves.value.data?.leaves
            ) {
                setLeaves(resLeaves.value.data.leaves);
            } else if (resLeaves.status === 'rejected') {
                console.error('Error loading authorized leaves:', resLeaves.reason);
                setError(t('error.GetError'));
            }

            if (resUsers.status === 'fulfilled' && resUsers.value.data?.users) {
                setUsers(resUsers.value.data.users);
            }
        } finally {
            if (seq === fetchSeq.current) setLoading(false);
        }
    }, [filterUserId, t]);

    useEffect(() => {
        fetchLeaves();
    }, [fetchLeaves]);

    const userNameOf = (id: string) =>
        users.find((u) => u._id === id)?.name ?? id;

    const requestCloseModal = () => {
        if (dirty && !window.confirm(t('common.unsavedChangesConfirm'))) return;
        setModalOpen(false);
        setEditing(null);
        resetDirty();
    };

    const openCreate = () => {
        setEditing(null);
        setModalUser(filterUserId === 'all' ? '' : filterUserId);
        setModalFrom('');
        setModalTo('');
        setModalNotes('');
        resetDirty();
        setModalOpen(true);
    };

    const openEdit = (leave: AuthorizedLeaveRow) => {
        setEditing(leave);
        setModalUser(leave.userId);
        setModalFrom(leave.startDate);
        setModalTo(leave.endDate);
        setModalNotes(leave.notes ?? '');
        resetDirty();
        setModalOpen(true);
    };

    const handleSave = async () => {
        if (!modalUser || !modalFrom || !modalTo) {
            setError(t('admin.authorizedLeaves.missingFields'));
            return;
        }
        if (modalTo < modalFrom) {
            setError(t('admin.authorizedLeaves.invalidInterval'));
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const body = {
                startDate: modalFrom as DateKey,
                endDate: modalTo as DateKey,
                notes: modalNotes.trim() || undefined,
            };
            const res = editing
                ? await apiClient.updateAuthorizedLeave(editing._id, body)
                : await apiClient.createAuthorizedLeave({
                      userId: modalUser,
                      ...body,
                  });
            if (res.error) {
                setError(t(`error.${res.error}`) || t('error.PutError'));
                return;
            }
            setModalOpen(false);
            setEditing(null);
            resetDirty();
            fetchLeaves();
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (leave: AuthorizedLeaveRow) => {
        if (!window.confirm(t('admin.authorizedLeaves.deleteConfirm'))) return;
        setDeletingId(leave._id);
        try {
            const res = await apiClient.deleteAuthorizedLeave(leave._id);
            if (res.error) {
                setError(t(`error.${res.error}`) || t('error.DeleteError'));
            } else {
                setLeaves((prev) => prev.filter((l) => l._id !== leave._id));
            }
        } finally {
            setDeletingId(null);
        }
    };

    const userLabel = users.find((u) => u._id === modalUser)?.name ?? '';

    return (
        <div className="mx-auto max-w-4xl space-y-4 p-4">
            <AdminBackButton />
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">
                    {t('admin.authorizedLeaves.title')}
                </h1>
                <Button onClick={openCreate} variant="primary">
                    <Plus size={16} />
                    {t('admin.authorizedLeaves.create')}
                </Button>
            </div>

            {error && (
                <Alert variant="destructive" onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            <div>
                <select
                    value={filterUserId}
                    onChange={(e) => setFilterUserId(e.target.value)}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                    aria-label={t('admin.authorizedLeaves.filter')}
                >
                    <option value="all">
                        {t('admin.authorizedLeaves.allUsers')}
                    </option>
                    {users.map((u) => (
                        <option key={u._id} value={u._id}>
                            {u.name}
                        </option>
                    ))}
                </select>
            </div>

            {loading ? (
                <LoadingState />
            ) : leaves.length === 0 ? (
                <EmptyState
                    icon={<ShieldCheck size={24} />}
                    title={t('admin.authorizedLeaves.empty')}
                />
            ) : (
                <Card className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {leaves.map((leave) => (
                        <div
                            key={leave._id}
                            className="flex flex-wrap items-center justify-between gap-3 p-4"
                        >
                            <div className="min-w-0">
                                <div className="text-sm font-medium text-zinc-900 dark:text-white">
                                    {userNameOf(leave.userId)}
                                    <span className="mx-2 text-zinc-300 dark:text-zinc-600">
                                        ·
                                    </span>
                                    <span className="whitespace-nowrap tabular-nums text-zinc-600 dark:text-zinc-300">
                                        {leave.startDate === leave.endDate
                                            ? leave.startDate
                                            : `${leave.startDate} → ${leave.endDate}`}
                                    </span>
                                </div>
                                {leave.notes && (
                                    <div className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                                        {leave.notes}
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => openEdit(leave)}
                                    className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                    title={t('common.edit')}
                                >
                                    <Pencil size={16} />
                                </button>
                                <button
                                    onClick={() => handleDelete(leave)}
                                    disabled={deletingId === leave._id}
                                    className="rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:opacity-30 dark:hover:bg-red-900/20"
                                    title={t('common.delete')}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </Card>
            )}

            {modalOpen &&
                typeof document !== 'undefined' && (
                    <Modal
                        open
                        title={
                            editing
                                ? t('admin.authorizedLeaves.editTitle')
                                : t('admin.authorizedLeaves.createTitle')
                        }
                        subtitle={
                            editing
                                ? `${userNameOf(editing.userId)} · ${editing.startDate}`
                                : userLabel
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
                                    onClick={handleSave}
                                    variant="primary"
                                    disabled={saving}
                                >
                                    {t('common.save')}
                                </Button>
                            </div>
                        }
                    >
                        {error && (
                            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                                {error}
                            </div>
                        )}
                        <div className="space-y-3">
                            {!editing && (
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                        {t('admin.authorizedLeaves.employee')}
                                    </label>
                                    <select
                                        value={modalUser}
                                        onChange={(e) => {
                                            setModalUser(e.target.value);
                                            markDirty();
                                        }}
                                        className={inputClass}
                                    >
                                        <option value="">
                                            {t(
                                                'admin.authorizedLeaves.selectEmployee'
                                            )}
                                        </option>
                                        {users.map((u) => (
                                            <option key={u._id} value={u._id}>
                                                {u.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                    {t('admin.authorizedLeaves.startDate')}
                                </label>
                                <input
                                    type="date"
                                    value={modalFrom}
                                    onChange={(e) => {
                                        setModalFrom(e.target.value);
                                        markDirty();
                                    }}
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                    {t('admin.authorizedLeaves.endDate')}
                                </label>
                                <input
                                    type="date"
                                    value={modalTo}
                                    onChange={(e) => {
                                        setModalTo(e.target.value);
                                        markDirty();
                                    }}
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                    {t('admin.authorizedLeaves.notes')}
                                </label>
                                <textarea
                                    value={modalNotes}
                                    onChange={(e) => {
                                        setModalNotes(e.target.value);
                                        markDirty();
                                    }}
                                    maxLength={2000}
                                    rows={2}
                                    placeholder={t(
                                        'admin.authorizedLeaves.notesPlaceholder'
                                    )}
                                    className={inputClass}
                                />
                            </div>
                            <p className="text-xs text-zinc-400">
                                {t('admin.authorizedLeaves.hint')}
                            </p>
                        </div>
                    </Modal>
                )}
        </div>
    );
}
