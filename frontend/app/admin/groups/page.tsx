'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '@/app/i18n';
import { apiClient } from '@/lib/api';
import { Group, User } from '@/types';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import GroupModal from '../../../components/GroupModal';
import AdminBackButton from '../../../components/AdminBackButton';
import { Plus, Edit2, Trash2, Users } from 'lucide-react';

export default function GroupsListPage() {
    const { t } = useI18n();
    const [groups, setGroups] = useState<Group[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const [creating, setCreating] = useState(false);
    const [editingGroup, setEditingGroup] = useState<Group | null>(null);

    const userMap = useMemo(() => {
        const map: Record<string, string> = {};
        users.forEach((u) => {
            map[u._id] = u.name;
        });
        return map;
    }, [users]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [groupsRes, dashRes] = await Promise.all([
                apiClient.getAllGroups(),
                apiClient.getAdminDashboard(),
            ]);
            if (groupsRes.data?.groups) {
                setGroups(groupsRes.data.groups);
            }
            if (dashRes.data?.users) {
                setUsers(dashRes.data.users);
            }
        } catch (error) {
            console.error('Error carregant grups:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const openDeleteModal = (group: Group) => {
        setGroupToDelete(group);
        setIsDeleteModalOpen(true);
        setErrorMsg(null);
    };

    const closeDeleteModal = () => {
        setIsDeleteModalOpen(false);
        setGroupToDelete(null);
        setErrorMsg(null);
    };

    const confirmDelete = async () => {
        if (!groupToDelete) return;
        setIsDeleting(true);
        setErrorMsg(null);

        try {
            const res = await apiClient.deleteGroup(groupToDelete._id);
            if (res.error) {
                setErrorMsg(
                    t('admin.groups.deleteError') + ' (' + res.error + ')'
                );
            } else {
                setGroups((prev) =>
                    prev.filter((g) => g._id !== groupToDelete._id)
                );
                closeDeleteModal();
            }
        } catch (error) {
            console.error('Error eliminant el grup:', error);
            setErrorMsg(t('admin.groups.deleteError'));
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="space-y-6">
            <AdminBackButton />

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                        {t('admin.groups.title')}
                    </h1>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-zinc-500">
                        <Users size={14} />
                        {groups.length} {t('admin.menu.groups.count')}
                    </p>
                </div>
                <Button variant="primary" onClick={() => setCreating(true)}>
                    <Plus size={16} />
                    {t('admin.groups.add')}
                </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                {loading ? (
                    <div className="col-span-2 p-8 text-center text-sm text-zinc-500 animate-pulse">
                        {t('common.loading')}
                    </div>
                ) : groups.length === 0 ? (
                    <div className="col-span-2 rounded-2xl border border-zinc-200 bg-white p-8 text-center text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                        {t('admin.groups.empty')}
                    </div>
                ) : (
                    groups.map((group) => (
                        <Card key={group._id} className="flex flex-col p-5">
                            <div>
                                <h3 className="truncate font-semibold text-zinc-900 dark:text-white">
                                    {group.name}
                                </h3>
                                <p className="mb-3 text-sm text-zinc-500">
                                    {group.description ||
                                        t('admin.groups.noDesc')}
                                </p>

                                <div className="mb-4">
                                    <p className="mb-1 text-xs font-medium text-zinc-500">
                                        {t('admin.groups.members')}
                                    </p>
                                    {group.members.length === 0 ? (
                                        <p className="text-xs text-zinc-400">
                                            {t('admin.groups.noMembers')}
                                        </p>
                                    ) : (
                                        <div className="flex flex-wrap gap-1.5">
                                            {group.members.map((m) => (
                                                <span
                                                    key={m}
                                                    className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                                                >
                                                    {userMap[m] ||
                                                        t('admin.users.noName')}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="mt-auto flex gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                                <button
                                    type="button"
                                    onClick={() => setEditingGroup(group)}
                                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-600"
                                >
                                    <Edit2 size={14} />
                                    {t('admin.groups.edit')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => openDeleteModal(group)}
                                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700"
                                >
                                    <Trash2 size={14} />
                                    {t('admin.groups.delete')}
                                </button>
                            </div>
                        </Card>
                    ))
                )}
            </div>

            {isDeleteModalOpen &&
                typeof document !== 'undefined' &&
                createPortal(
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
                        <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
                            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30">
                                <Trash2 size={24} />
                            </div>
                            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                                {t('admin.groups.deleteConfirmTitle')}
                            </h3>
                            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                                {t('admin.groups.deleteConfirmDesc')}
                            </p>
                            {errorMsg && (
                                <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                                    {errorMsg}
                                </div>
                            )}
                            <div className="mt-6 flex gap-3">
                                <Button
                                    onClick={closeDeleteModal}
                                    disabled={isDeleting}
                                    variant="secondary"
                                    className="flex-1"
                                >
                                    {t('common.cancel')}
                                </Button>
                                <Button
                                    onClick={confirmDelete}
                                    disabled={isDeleting}
                                    variant="danger"
                                    className="flex-1"
                                >
                                    {isDeleting
                                        ? t('common.loading')
                                        : t('admin.groups.delete')}
                                </Button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

            <GroupModal
                open={creating || !!editingGroup}
                group={editingGroup}
                onClose={() => {
                    setCreating(false);
                    setEditingGroup(null);
                }}
                onSaved={fetchData}
            />
        </div>
    );
}
