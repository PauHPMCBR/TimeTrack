"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/app/i18n";
import { apiClient } from "@/lib/api"; 
import { Group } from "@/types"; 
import LanguageSwitcher from "../../../components/LanguageSwitcher"; 

export default function GroupsListPage() {
  const { t } = useI18n();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  // Estats per al Modal d'Eliminar
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

  // 1. Obre el modal
  const openDeleteModal = (id: string) => {
    setGroupToDelete(id);
    setIsDeleteModalOpen(true);
    setErrorMsg(null);
  };

  // 2. Tanca el modal
  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setGroupToDelete(null);
    setErrorMsg(null);
  };

  // 3. Executa l'eliminació real
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
        // Si va bé, actualitzem la llista i tanquem
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
          <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
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
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
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
                <div key={group._id} className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
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
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                            {t("admin.groups.edit")}
                        </Link>

                        {/* Botó Eliminar (Obre Modal) */}
                        <button 
                            onClick={() => openDeleteModal(group._id)}
                            className="flex-1 inline-flex justify-center items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            {t("admin.groups.delete")}
                        </button>
                    </div>
                </div>
             ))
          )}
        </div>
      </div>

      {/* --- MODAL PERSONALITZAT PER ELIMINAR --- */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in duration-200">
            
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
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
              <button
                onClick={closeDeleteModal}
                disabled={isDeleting}
                className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {isDeleting ? t("common.loading") : t("admin.groups.delete")}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}