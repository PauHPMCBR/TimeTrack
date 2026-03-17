"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/app/i18n";
import { apiClient } from "@/lib/api";
import { User, Group } from "@/types";
import { Users, ChevronLeft, Mail, Shield, User as UserIcon } from "lucide-react";

export default function GroupDetailPage() {
  const { t } = useI18n();
  const params = useParams();
  const router = useRouter();
  const groupId = params?.groupId as string;

  const [group, setGroup] = useState<Group | null>(null);
  const [memberDetails, setMemberDetails] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) return;

    const fetchGroup = async () => {
      try {
        setLoading(true);
        const res = await apiClient.getGroupInfo(groupId);
        if (res.data) {
          setGroup(res.data.group);
        }
      } catch (error) {
        console.error("Error loading group:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchGroup();
  }, [groupId]);

  useEffect(() => {
    if (!group) return;

    const fetchMembers = async () => {
      const details = [];
      for (const memberId of group.members) {
        try {
          const res = await apiClient.getProfile(memberId);
          if (res.data?.user) {
            details.push(res.data.user);
          }
        } catch (e) {
          console.error(`Failed to fetch user ${memberId}:`, e);
        }
      }
      setMemberDetails(details);
    };

    fetchMembers();
  }, [group]);

  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-zinc-500 animate-pulse">
        {t("common.loading")}
      </div>
    );
  }

  if (!group) {
    return (
      <div className="p-8 text-center text-red-500">
        {t("groups.notFound")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.back()}
          className="rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{group.name}</h1>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-4 mb-4">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
            <Users size={24} />
          </div>
          <div>
            <div className="text-sm text-zinc-500">{t("groups.groupDescription")}</div>
            <div className="text-zinc-900 dark:text-zinc-100">
              {group.description || t("groups.noDescription")}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
          {t("groups.members")} ({memberDetails.length})
        </h2>
        
        <div className="grid gap-3">
          {memberDetails.map((member) => (
            <Link
              key={member._id}
              href={`/profile/${member._id}`}
              className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 transition-all hover:border-indigo-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-700 dark:hover:bg-zinc-800/50"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  <span className="text-sm font-bold">
                    {(member.name || member.email || "U")[0].toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="font-medium text-zinc-900 dark:text-white">
                    {member.name || t("common.noName")}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <Mail size={12} />
                    {member.email}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {member.role === 'admin' && (
                  <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">
                    {t("profile.role.admin")}
                  </span>
                )}
                <ChevronLeft size={16} className="rotate-180 text-zinc-300" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
