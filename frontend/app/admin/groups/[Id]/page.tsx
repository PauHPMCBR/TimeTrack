"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/app/i18n";
import { apiClient } from "@/lib/api";
import { User } from "@/types"; 
import LanguageSwitcher from "../../../../components/LanguageSwitcher"; 
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { ChevronRight, Check } from "lucide-react";

export default function EditGroupPage() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useParams();
  
  const groupId = (params?.Id || params?.id || params?.groupId || params?._id || "") as string;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  
  const [allUsers, setAllUsers] = useState<User[]>([]); 
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set()); 

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);

      const [groupRes, usersRes] = await Promise.all([
        apiClient.getGroupInfo(groupId),
        apiClient.getCompanyUsers()
      ]);
      if (cancelled) return;

      let foundUsers: User[] = [];
      if (usersRes.data && Array.isArray(usersRes.data)) {
           foundUsers = usersRes.data;
      } else if (usersRes.data && usersRes.data.users) {
           foundUsers = usersRes.data.users;
      }
      setAllUsers(foundUsers);

      if (groupRes.error) {
        setError(groupRes.error);
      } else if (groupRes.data) {
          const groupData = groupRes.data.group || groupRes.data;

          setName(groupData.name || "");
          setDescription(groupData.description || "");

          const membersList = groupData.members;

          if (membersList && Array.isArray(membersList)) {
              const existingIds = membersList.map((u: User | string) =>
                typeof u === "string" ? u : u._id
              );
              setSelectedUserIds(new Set(existingIds));
          }
      }

      setLoading(false);
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  const toggleUser = (userId: string) => {
    const newSelected = new Set(selectedUserIds);
    if (newSelected.has(userId)) newSelected.delete(userId); 
    else newSelected.add(userId); 
    setSelectedUserIds(newSelected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const usersArray = Array.from(selectedUserIds);

    const res = await apiClient.updateGroup(groupId, {
      name,
      description,
      members: usersArray
    });

    if (res.error) {
      setError(res.error);
    } else {
      router.push("/admin/groups");
    }
    setSaving(false);
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
          <ChevronRight className="mr-1 h-4 w-4" />
          {t("common.back")}
        </Link>
        <LanguageSwitcher />
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6">
        <Card className="p-8">
          <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-white">
            {t("admin.groups.editTitle")}
          </h1>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
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
                                        {isSelected && <Check className="w-3 h-3 text-white" />}
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
                {saving ? t("common.saving") : t("common.save")}
            </Button>
            {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                    {t(`error.${error}`)}
                </div>
            )}
          </form>
        </Card>
      </div>
    </div>
  );
}