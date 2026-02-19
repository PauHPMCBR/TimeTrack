"use client";

import { useI18n } from "@/app/i18n";

const langs = [
  { code: "ca" as const, label: "CA" },
  { code: "es" as const, label: "ES" },
  { code: "en" as const, label: "EN" },
];

export default function LanguageSwitcher() {
  const { lang, setLang } = useI18n();

  return (
    <div className="flex items-center gap-1">
      {langs.map((l) => {
        const active = lang === l.code;
        return (
          <button
            key={l.code}
            onClick={() => setLang(l.code)}
            className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              active
                ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-white"
                : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {l.label}
          </button>
        );
      })}
    </div>
  );
}