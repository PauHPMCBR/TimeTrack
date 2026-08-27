'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import { useDirty } from '@/lib/useDirty';
import { User, Group } from '@/types';
import Modal from '@/components/Modal';
import Button from '@/components/ui/Button';
import TextField from '@/components/ui/TextField';
import TextAreaField from '@/components/ui/TextAreaField';
import { Check } from 'lucide-react';

type Props = {
    open: boolean;
    group: Group | null; // null = create
    onClose: () => void;
    onSaved?: () => void;
};

/**
 * Reusable admin modal to create or edit a department/group. Passing a group
 * edits it, passing null creates a new one.
 */
export default function GroupModal({ open, group, onClose, onSaved }: Props) {
    const { t } = useI18n();

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(
        new Set()
    );
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { dirty, markDirty, resetDirty } = useDirty();

    useEffect(() => {
        if (!open) return;
        let cancelled = false;

        setLoading(true);
        setError(null);
        setName(group?.name ?? '');
        setDescription(group?.description ?? '');
        resetDirty();

        const ids = (group?.members ?? []).map((m: User | string) =>
            typeof m === 'string' ? m : m._id
        );
        setSelectedUserIds(new Set(ids));

        apiClient.getCompanyUsers().then((res) => {
            if (cancelled) return;
            let found: User[] = [];
            if (res.data && Array.isArray(res.data)) found = res.data;
            else if (res.data && res.data.users) found = res.data.users;
            setAllUsers(found);
            setLoading(false);
        });

        return () => {
            cancelled = true;
        };
    }, [open, group]);

    const requestClose = () => {
        if (dirty && !window.confirm(t('common.unsavedChangesConfirm'))) return;
        onClose();
    };

    const toggleUser = (userId: string) => {
        setSelectedUserIds((prev) => {
            const next = new Set(prev);
            if (next.has(userId)) next.delete(userId);
            else next.add(userId);
            return next;
        });
        markDirty();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        const members = Array.from(selectedUserIds);
        const payload = { name, description, members };

        const res = group
            ? await apiClient.updateGroup(group._id, payload)
            : await apiClient.createGroup(payload);

        setSaving(false);

        if (res.error) {
            setError(
                t(`error.${res.error}`) === `error.${res.error}`
                    ? res.error
                    : t(`error.${res.error}`)
            );
            return;
        }

        onSaved?.();
        onClose();
    };

    return (
        <Modal
            open={open}
            title={
                group
                    ? t('admin.groups.editTitle')
                    : t('admin.groups.createTitle')
            }
            onClose={requestClose}
        >
            {error && (
                <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="p-10 text-center animate-pulse text-zinc-500">
                    {t('common.loading')}
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                    <TextField
                        label={t('admin.groups.name')}
                        type="text"
                        required
                        value={name}
                        onChange={(e) => {
                            setName(e.target.value);
                            markDirty();
                        }}
                        placeholder={t('admin.groups.namePlaceholder')}
                    />

                    <TextAreaField
                        label={`${t('admin.groups.desc')} ${t('common.optional')}`}
                        rows={2}
                        value={description}
                        onChange={(e) => {
                            setDescription(e.target.value);
                            markDirty();
                        }}
                        placeholder={t('admin.groups.descPlaceholder')}
                    />

                    <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800">
                        <h3 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            {t('admin.groups.addMembers')} ({allUsers.length})
                        </h3>

                        {allUsers.length === 0 ? (
                            <div className="rounded border border-zinc-100 bg-zinc-50 p-4 text-center text-sm italic text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                                {t('admin.groups.noUsers')}
                            </div>
                        ) : (
                            <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-900">
                                {allUsers.map((user) => {
                                    const isSelected = selectedUserIds.has(
                                        user._id
                                    );
                                    const displayName =
                                        user.name || t('admin.users.noName');
                                    const initial = displayName
                                        .charAt(0)
                                        .toUpperCase();
                                    return (
                                        <div
                                            key={user._id}
                                            onClick={() => toggleUser(user._id)}
                                            className={`flex cursor-pointer items-center justify-between rounded-md p-2 transition-colors ${
                                                isSelected
                                                    ? 'border border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-900/20'
                                                    : 'border border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${isSelected ? 'bg-indigo-600 text-white' : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300'}`}
                                                >
                                                    {initial}
                                                </div>
                                                <div>
                                                    <p
                                                        className={`text-sm font-medium ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-zinc-700 dark:text-zinc-300'}`}
                                                    >
                                                        {displayName}
                                                    </p>
                                                    <p className="text-xs text-zinc-500">
                                                        {user.email}
                                                    </p>
                                                </div>
                                            </div>
                                            <div
                                                className={`flex h-5 w-5 items-center justify-center rounded-full border ${isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800'}`}
                                            >
                                                {isSelected && (
                                                    <Check className="h-3 w-3 text-white" />
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <Button
                        type="submit"
                        disabled={saving}
                        variant="primary"
                        className="w-full"
                    >
                        {saving ? t('common.saving') : t('common.save')}
                    </Button>
                </form>
            )}
        </Modal>
    );
}
