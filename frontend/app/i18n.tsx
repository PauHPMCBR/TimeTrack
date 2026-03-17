"use client";

import React, { createContext, useState, useContext, useCallback, useMemo } from "react";
import ca from "../locales/ca.json";
import es from "../locales/es.json";
import en from "../locales/en.json";

type Lang = "ca" | "es" | "en";
type Dict = Record<string, string>;

const dictionaries: Record<Lang, Dict> = { ca, es, en };

type I18nContextType = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export default function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("lang") as Lang;
      if (saved && (saved === "ca" || saved === "es" || saved === "en")) return saved;
    }
    return "ca";
  });

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("lang", l);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const dict = (dictionaries[lang] || dictionaries.ca) as Dict;
      let text = dict[key] || key;
      
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

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within <I18nProvider>");
  return ctx;
}
