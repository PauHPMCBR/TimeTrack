"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/app/i18n";
import { apiClient } from "@/lib/api";
import { Group } from "@/types";
import { Users, ChevronRight } from "lucide-react";

export default function UserGroupsPage() {
  const { t } = useI18n();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        setLoading(true);
        const currentUser = await apiClient.getCurrentUser();
        if (currentUser) {
          const res = await apiClient.getUserGroups(currentUser._id);
          if (res.data && res.data.groups) {
            setGroups(res.data.groups);
          }
        }
      } catch (error) {
        console.error("Error loading groups:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchGroups();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("groups.title")}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t("groups.subtitle")}</p>
      </div>

      <div className="grid gap-4">
        {loading ? (
          <div className="p-8 text-center text-sm text-zinc-500 animate-pulse">{t("common.loading")}</div>
        ) : groups.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
            {t("groups.empty")}
          </div>
        ) : (
          groups.map((group) => (
            <Link
              key={group._id}
              href={`/groups/${group._id}`}
              className="group flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-all hover:border-indigo-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-700 dark:hover:bg-zinc-800/50"
            >
              <div className="flex items-center gap-4">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                  <Users size={24} />
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {group.name}
                  </h3>
                  <p className="text-sm text-zinc-500 line-clamp-1">
                    {group.description || t("groups.noDescription")}
                  </p>
                </div>
              </div>
              <ChevronRight size={20} className="text-zinc-400 group-hover:text-indigo-500 transition-colors" />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
