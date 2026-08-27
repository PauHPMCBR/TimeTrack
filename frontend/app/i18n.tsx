'use client';

import React, {
    createContext,
    useState,
    useContext,
    useCallback,
    useEffect,
    useMemo,
} from 'react';
import ca from '../locales/ca.json';
import es from '../locales/es.json';
import en from '../locales/en.json';
import { LANG_KEY } from '@/lib/storage';

type Lang = 'ca' | 'es' | 'en';
type DictValue = string | { [k: string]: DictValue };
type Dict = Record<string, DictValue>;

const dictionaries: Record<Lang, Dict> = { ca, es, en };
const DEFAULT_LANG: Lang = 'ca';

function isLang(value: string | null): value is Lang {
    return value === 'ca' || value === 'es' || value === 'en';
}

// Resolve a dot-separated key ("vacations.submit") through a nested dictionary.
function lookup(dict: Dict, key: string): string | undefined {
    let node: DictValue | undefined = dict;
    for (const part of key.split('.')) {
        if (typeof node !== 'object' || node === null) return undefined;
        node = (node as Dict)[part];
    }
    return typeof node === 'string' ? node : undefined;
}

type I18nContextType = {
    lang: Lang;
    setLang: (l: Lang) => void;
    t: (key: string, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export default function I18nProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    // Start with the default so server and client render identically,
    // then load the persisted language after mount (avoids hydration mismatch).
    const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

    useEffect(() => {
        const saved = localStorage.getItem(LANG_KEY);
        if (isLang(saved) && saved !== DEFAULT_LANG) {
            setLangState(saved);
        }
    }, []);

    useEffect(() => {
        document.documentElement.lang = lang;
    }, [lang]);

    const setLang = useCallback((l: Lang) => {
        setLangState(l);
        if (typeof window !== 'undefined') localStorage.setItem(LANG_KEY, l);
    }, []);

    const t = useCallback(
        (key: string, params?: Record<string, string | number>) => {
            const dict = (dictionaries[lang] || dictionaries.ca) as Dict;
            let text = lookup(dict, key) ?? key;

            if (params) {
                Object.entries(params).forEach(([k, v]) => {
                    text = text.replace(`{${k}}`, String(v));
                });
            }

            return text;
        },
        [lang]
    );

    const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

    return (
        <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
    );
}

export function useI18n() {
    const ctx = useContext(I18nContext);
    if (!ctx) throw new Error('useI18n must be used within <I18nProvider>');
    return ctx;
}
