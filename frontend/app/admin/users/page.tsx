"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/app/i18n";
import { apiClient } from "@/lib/api"; 
import { User } from "@/types"; 
// Ruta relativa: pugem 3 nivells (users -> admin -> app -> frontend -> components)
import LanguageSwitcher from "../../../components/LanguageSwitcher"; 

export default function UsersListPage() {
  const { t } = useI18n();
  
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const res = await apiClient.getCompanyUsers();
        
        if (res.data && Array.isArray(res.data)) {
          setUsers(res.data);
        } else if (res.data && (res.data as any).users) {
          setUsers((res.data as any).users);
        }
      } catch (error) {
        console.error("Error carregant usuaris:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      
      {/* HEADER */}
      <header className="flex w-full items-center justify-between px-6 py-4">
        {/* Canviat: Ara torna al menú d'Admin (/admin), no al perfil */}
        <Link href="/admin" className="inline-flex items-center text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
          <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t("common.back")}
        </Link>
        <LanguageSwitcher />
      </header>

      {/* CONTINGUT */}
      <div className="mx-auto max-w-3xl px-4 py-6">
        
        {/* Títol i Botó Crear */}
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("admin.menu.users.title")}</h1>
            <p className="mt-1 text-sm text-zinc-500">{t("admin.dashboard.subtitle")}</p>
          </div>
          
          <Link 
            href="/admin/users/create" 
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
            {t("admin.dashboard.addUser")}
          </Link>
        </div>

        {/* LLISTA */}
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {loading ? (
             <div className="p-8 text-center text-sm text-zinc-500 animate-pulse">
                {t("common.loading")}
             </div>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {users.length === 0 && (
                    <div className="p-8 text-center text-sm text-zinc-500">
                        No s'han trobat usuaris.
                    </div>
                )}
                {users.map((user) => (
                <li key={user._id} className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="grid h-10 w-10 place-items-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                            {user.name ? user.name.charAt(0).toUpperCase() : "?"}
                        </div>
                        <div>
                            <div className="font-medium text-zinc-900 dark:text-white">
                                {user.name || "Sense nom"} 
                                {user.role === 'admin' && (
                                    <span className="ml-2 inline-flex items-center rounded-md bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                                        Admin
                                    </span>
                                )}
                            </div>
                            <div className="text-xs text-zinc-500">{user.email}</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {user.registered ? (
                            <div className="flex items-center gap-2 rounded-full bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-600 ring-1 ring-inset ring-zinc-500/10 dark:bg-zinc-400/10 dark:text-zinc-400 dark:ring-zinc-400/20">
                                <span className="h-1.5 w-1.5 rounded-full bg-zinc-400"></span>
                                Registrat
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-600/20 dark:bg-orange-500/10 dark:text-orange-400 dark:ring-orange-500/20">
                                <span className="h-1.5 w-1.5 rounded-full bg-orange-400"></span>
                                Pendent d'activació
                            </div>
                        )}
                    </div>
                </li>
                ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}