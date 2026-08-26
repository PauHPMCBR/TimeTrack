"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/app/i18n";
import { apiClient } from "@/lib/api"; 
import { Group } from "@/types"; 
import LanguageSwitcher from "../../../components/LanguageSwitcher"; 
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { ChevronRight, Plus, Edit2, Trash2 } from "lucide-react";

export default function GroupsListPage() {
  const { t } = useI18n();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        setLoading(true);
        const res = await apiClient.getAllGroups();
        if (res.data && (res.data as any).groups) {
          setGroups((res.data as any).groups);
        }
      } catch (error) {
        console.error("Error carregant grups:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchGroups();
  }, []);

  const openDeleteModal = (id: string) => {
    setGroupToDelete(id);
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
      const res = await apiClient.deleteGroup(groupToDelete);

      if (res.error) {
        // En lloc d'alert, mostrem l'error al modal
        setErrorMsg(t("admin.groups.deleteError") + " (" + res.error + ")");
      } else {
        setGroups((prev) => prev.filter((group) => group._id !== groupToDelete));
        closeDeleteModal();
      }
    } catch (error) {
      console.error("Error eliminant el grup:", error);
      setErrorMsg(t("admin.groups.deleteError"));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 relative">
      <header className="flex w-full items-center justify-between px-6 py-4">
        <Link href="/admin" className="inline-flex items-center text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
          <ChevronRight className="mr-1 h-4 w-4" />
          {t("common.back")}
        </Link>
        <LanguageSwitcher />
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("admin.groups.title")}</h1>
            <p className="mt-1 text-sm text-zinc-500">{t("admin.groups.subtitle")}</p>
          </div>
          <Link href="/admin/groups/create" className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors">
            <Plus size={16} />
            {t("admin.groups.add")}
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {loading ? (
             <div className="col-span-2 p-8 text-center text-sm text-zinc-500 animate-pulse">{t("common.loading")}</div>
          ) : groups.length === 0 ? (
             <div className="col-span-2 rounded-2xl border border-zinc-200 bg-white p-8 text-center text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">{t("admin.groups.empty")}</div>
          ) : (
             groups.map((group) => (
                <Card key={group._id} className="flex flex-col justify-between p-5">
                    <div>
                        <h3 className="font-semibold text-zinc-900 dark:text-white truncate">{group.name}</h3>
                        <p className="text-sm text-zinc-500 mb-4">{group.description || "Sense descripció"}</p>
                    </div>
                    
                    <div className="flex gap-3 mt-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                        {/* Botó Editar (Traduït) */}
                        <Link 
                            href={`/admin/groups/${group._id}`} 
                            className="flex-1 inline-flex justify-center items-center gap-2 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 transition-colors"
                        >
                            <Edit2 size={14} />
                            {t("admin.groups.edit")}
                        </Link>

                        {/* Botó Eliminar (Obre Modal) */}
                        <button 
                            onClick={() => openDeleteModal(group._id)}
                            className="flex-1 inline-flex justify-center items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors"
                        >
                            <Trash2 size={14} />
                            {t("admin.groups.delete")}
                        </button>
                    </div>
                </Card>
             ))
          )}
        </div>
      </div>

      {/* --- MODAL PERSONALITZAT PER ELIMINAR --- */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in duration-200">
            
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30">
              <Trash2 size={24} />
            </div>

            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
              {t("admin.groups.deleteConfirmTitle")}
            </h3>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {t("admin.groups.deleteConfirmDesc")}
            </p>

            {/* Missatge d'error si falla l'API */}
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
                {t("common.cancel")}
              </Button>
              <Button
                onClick={confirmDelete}
                disabled={isDeleting}
                variant="danger"
                className="flex-1"
              >
                {isDeleting ? t("common.loading") : t("admin.groups.delete")}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}