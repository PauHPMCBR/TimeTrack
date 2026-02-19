"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/app/i18n";
import { apiClient } from "@/lib/api";
import { User } from "@/types"; 
import LanguageSwitcher from "../../../../components/LanguageSwitcher"; 

export default function EditGroupPage() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useParams();
  
  // CORRECCIÓ CLAU: Mantenim la lògica de la ID que ja et funciona
  const groupId = (params?.Id || params?.id || params?.groupId || params?._id || "") as string;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  
  const [allUsers, setAllUsers] = useState<User[]>([]); 
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set()); 

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!groupId) {
      console.error("Error: No ID found");
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        
        const [groupRes, usersRes] = await Promise.all([
          apiClient.getGroupInfo(groupId),
          apiClient.getCompanyUsers()
        ]);

        // --- GESTIÓ USUARIS ---
        let foundUsers: User[] = [];
        if (usersRes.data && Array.isArray(usersRes.data)) {
             foundUsers = usersRes.data;
        } else if (usersRes.data && (usersRes.data as any).users) {
             foundUsers = (usersRes.data as any).users;
        }
        setAllUsers(foundUsers);

        // --- GESTIÓ GRUP ---
        if (groupRes.data) {
            // Mirem si ve dins de .group o directe
            const groupData = (groupRes.data as any).group || groupRes.data;
            
            setName(groupData.name || ""); 
            setDescription(groupData.description || "");

            // Marquem els usuaris que ja són al grup (poden venir com 'users' o 'members')
            const membersList = groupData.members || groupData.users;
            
            if (membersList && Array.isArray(membersList)) {
                const existingIds = membersList.map((u: any) => u._id || u);
                setSelectedUserIds(new Set(existingIds));
            }
        }

      } catch (error: any) {
        console.error("Error loading data:", error);
        alert(t("error.GetError")); // Usem traducció d'error
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [groupId, t]);

  const toggleUser = (userId: string) => {
    const newSelected = new Set(selectedUserIds);
    if (newSelected.has(userId)) newSelected.delete(userId); 
    else newSelected.add(userId); 
    setSelectedUserIds(newSelected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const usersArray = Array.from(selectedUserIds);
      
      const res = await apiClient.updateGroup(groupId, {
        name,
        description,
        // Enviem com a 'members' si és el que espera el teu backend, o 'users'
        members: usersArray as any 
      });

      if (res.error) {
        // Mostrem l'error traduït si és possible, o el missatge del server
        alert(t("error.PutError") + ": " + (t(`error.${res.error}`) || res.error));
      } else {
        router.push("/admin/groups");
      }
    } catch (error) {
      console.error(error);
      alert(t("error.PutError"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <p className="text-zinc-500 animate-pulse">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-20">
      <header className="flex w-full items-center justify-between px-6 py-4">
        <Link href="/admin/groups" className="inline-flex items-center text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
          <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          {t("common.back")}
        </Link>
        <LanguageSwitcher />
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {/* TÍTOL TRADUÏT */}
          <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-white">
            {t("admin.groups.editTitle")}
          </h1>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
                {/* LABEL NOM TRADUÏT */}
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {t("admin.groups.name")}
                </label>
                <input 
                    type="text" 
                    required 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    className="mt-1 block w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" 
                />
            </div>
            <div>
                {/* LABEL DESCRIPCIÓ TRADUÏT */}
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {t("admin.groups.desc")}
                </label>
                <textarea 
                    rows={2} 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)} 
                    className="mt-1 block w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white" 
                />
            </div>

            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                {/* TÍTOL SECCIÓ MEMBRES TRADUÏT */}
                <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-1">
                    {t("admin.groups.membersTitle")} ({allUsers.length})
                </h3>
                <p className="mb-3 text-xs text-zinc-500">
                    {t("admin.groups.clickHelper")}
                </p>
                
                {allUsers.length === 0 ? (
                    <div className="p-4 bg-zinc-50 rounded text-sm text-zinc-500 italic text-center border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800">
                        {t("admin.groups.noUsers")}
                    </div>
                ) : (
                    <div className="max-h-60 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-2 space-y-1">
                        {allUsers.map((user) => {
                            const isSelected = selectedUserIds.has(user._id);
                            // Fem servir user.name i t("common.noName") per si és buit
                            const displayName = user.name || t("common.noName");
                            const initial = displayName.charAt(0).toUpperCase();

                            return (
                                <div 
                                    key={user._id} 
                                    onClick={() => toggleUser(user._id)} 
                                    className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
                                        isSelected 
                                            ? "bg-indigo-50 border border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800" 
                                            : "hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-transparent"
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                                            isSelected ? "bg-indigo-600 text-white" : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                                        }`}>
                                            {initial}
                                        </div>
                                        <div>
                                            <p className={`text-sm font-medium ${isSelected ? "text-indigo-700 dark:text-indigo-300" : "text-zinc-700 dark:text-zinc-300"}`}>
                                                {displayName}
                                            </p>
                                            <p className="text-xs text-zinc-500">{user.email}</p>
                                        </div>
                                    </div>
                                    
                                    <div className={`h-5 w-5 rounded-full border flex items-center justify-center ${
                                        isSelected ? "bg-indigo-600 border-indigo-600" : "border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800"
                                    }`}>
                                        {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <button 
                type="submit" 
                disabled={saving} 
                className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
            >
                {/* BOTÓ GUARDAR TRADUÏT */}
                {saving ? t("common.saving") : t("common.save")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}