"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/app/i18n";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api"; 
import LanguageSwitcher from "../../../../components/LanguageSwitcher"; 
import Button from "@/components/ui/Button";
import { ChevronLeft, Check } from "lucide-react";
import { CreateGroupRequest } from "@/schemas/api";
import { User } from "@/types"; 

export default function CreateGroupPage() {
  const { t } = useI18n(); 
  const router = useRouter();
  
  const [formData, setFormData] = useState<CreateGroupRequest>({ name: "", description: "" , members: []});
  
  const [allUsers, setAllUsers] = useState<User[]>([]); 
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set()); 

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchUsers = async () => {
      const res = await apiClient.getCompanyUsers();
      if (!cancelled) {
        if (res.data && Array.isArray(res.data)) {
          setAllUsers(res.data);
        } else if (res.data && res.data.users) {
          setAllUsers(res.data.users);
        }
      }
    };

    fetchUsers();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleUser = (userId: string) => {
    const newSelected = new Set(selectedUserIds);
    if (newSelected.has(userId)) newSelected.delete(userId); 
    else newSelected.add(userId); 
    setSelectedUserIds(newSelected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const membersArray = Array.from(selectedUserIds);

    const res = await apiClient.createGroup({
      ...formData,
      members: membersArray
    });

    if (res.error) {
      setError(t(`error.${res.error}`));
    } else {
      router.push("/admin/groups");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-20">
      <header className="flex w-full items-center justify-between px-6 py-4">
        <Link href="/admin/groups" className="inline-flex items-center text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
          <ChevronLeft className="mr-1 h-4 w-4" />
          {t("common.back")}
        </Link>
        <LanguageSwitcher />
      </header>

      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("admin.groups.createTitle")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t("admin.groups.createSubtitle")}</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">{t("admin.groups.name")}</label>
              <input 
                type="text" 
                required 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
                className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:text-white" 
                placeholder={t("admin.groups.namePlaceholder")} 
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">{t("admin.groups.desc")} {t("common.optional")}</label>
              <textarea 
                rows={3} 
                value={formData.description} 
                onChange={e => setFormData({...formData, description: e.target.value})} 
                className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:text-white" 
                placeholder={t("admin.groups.descPlaceholder")} 
              />
            </div>

            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3">
                    {t("admin.groups.addMembers")} ({allUsers.length})
                </h3>
                
                {allUsers.length === 0 ? (
                    <div className="p-4 bg-zinc-50 rounded text-sm text-zinc-500 italic text-center border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800">
                        {t("admin.groups.noUsers")}
                    </div>
                ) : (
                    <div className="max-h-60 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-2 space-y-1">
                        {allUsers.map((user) => {
                            const isSelected = selectedUserIds.has(user._id);
                            const displayName = user.name || t("admin.users.noName");
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
                                        {isSelected && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

          </div>
          
          <Button type="submit" disabled={loading} variant="primary" className="mt-8 w-full">
            {loading ? t("common.loading") : t("common.save")}
          </Button>
          {error && (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}