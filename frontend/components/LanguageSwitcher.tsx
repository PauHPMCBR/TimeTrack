'use client';

import { useI18n } from '@/app/i18n';
import { LANGUAGES } from 'shared/src/lib/constants';

export default function LanguageSwitcher() {
    const { lang, setLang } = useI18n();

    return (
        <div className="flex items-center gap-1">
            {LANGUAGES.map((code) => {
                const active = lang === code;
                return (
                    <button
                        key={code}
                        onClick={() => setLang(code)}
                        aria-pressed={active}
                        className={`flex h-8 min-w-9 items-center justify-center rounded-md px-1.5 text-xs font-semibold transition-colors ${
                            active
                                ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-white'
                                : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
                        }`}
                    >
                        {code.toUpperCase()}
                    </button>
                );
            })}
        </div>
    );
}
