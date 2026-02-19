"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useI18n } from "@/app/i18n";
import { apiClient } from "@/lib/api";

export default function HeaderBar() {
  const { t } = useI18n();
  const [email, setEmail] = useState<string | null>(); // TODO translations
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const storedEmail = localStorage.getItem("remembered_email");
    setEmail(storedEmail || "Sense Sessió");
  }, []);

  const handleLogout = () => {
    apiClient.logoff();
    setOpen(false);
    router.push("/");
  };

  const initial = email && email !== "Sense Sessió" ? email.trim()[0]?.toUpperCase() : "U";

  return (
    <div className="w-full flex items-center justify-between px-2 sm:px-3">
      <LanguageSwitcher />

      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center font-bold shadow-sm hover:scale-105 transition-transform text-sm"
        >
          {initial}
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-zinc-900 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden flex flex-col z-50">
            <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800">
              <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase font-bold">Usuari</p>
              <p className="text-sm text-zinc-900 dark:text-zinc-100 truncate">{email}</p>
            </div>

            <div className="p-1">
              <button
                onClick={handleLogout}
                className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md font-semibold transition-colors"
              >
                {t("header.logOff")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}