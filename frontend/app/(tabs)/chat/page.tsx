"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown"; 
import remarkGfm from "remark-gfm";
import { useI18n } from "../../i18n";

type Msg = { role: "user" | "bot"; text: string };

export default function ChatPage() {
  const { t, lang } = useI18n();
  const [input, setInput] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]); 
  const [loading, setLoading] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // --- CONFIGURACIÓ URL BACKEND (MODIFICAT) ---
  // Utilitzem 127.0.0.1 en lloc de localhost per evitar errors de DNS/Node
  const backendHost = process.env.NEXT_PUBLIC_BACKEND_URL || '127.0.0.1:3001';
  // Assegura't que no hi ha doble 'http' si ve de l'env
  const protocol = backendHost.includes('http') ? '' : 'http://';
  const apiUrl = `${protocol}${backendHost}/api/chat`;

  useEffect(() => {
    if (typeof window !== "undefined") {
      const email = localStorage.getItem("remembered_email");
      setUserEmail(email);
      if (email) {
        const saved = localStorage.getItem(`chat_history_${email}`);
        if (saved) {
          try {
            setMsgs(JSON.parse(saved));
          } catch {
            setMsgs([]);
          }
        }
      }
    }
  }, []);

  useEffect(() => {
    if (userEmail && msgs.length > 0) {
      localStorage.setItem(`chat_history_${userEmail}`, JSON.stringify(msgs));
    }
  }, [msgs, userEmail]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [msgs.length, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    setLoading(true);
    const newMsgs = [...msgs, { role: "user" as const, text }]; 
    setMsgs(newMsgs);
    setInput("");

    try {
      const historyPayload = newMsgs.slice(-6).map(m => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.text
      }));

      // Log per veure on estem disparant
      console.log(`📡 Intentant connectar a: ${apiUrl}`);

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          lang: lang,
          email: userEmail,
          history: historyPayload 
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "Error desconegut");
        throw new Error(`Estat ${res.status}: ${errText}`);
      }

      const data = await res.json();
      setMsgs((m) => [
        ...m,
        { role: "bot", text: data.reply ?? "..." },
      ]);
    } catch (e: any) {
      console.error("❌ Error Chat:", e);
      
      let errorMsg = "No puc connectar amb el servidor.";
      // Missatge d'ajuda visual
      if (e.message && e.message.includes("Failed to fetch")) {
        errorMsg = `Error de connexió (Failed to fetch). \n\n1. Comprova que el backend corre al port 3001.\n2. URL destí: ${apiUrl}`;
      } else {
        errorMsg = `Error: ${e.message}`;
      }

      setMsgs((m) => [
        ...m,
        { role: "bot", text: `⚠️ ${errorMsg}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  function clearChat() {
    if (userEmail) localStorage.removeItem(`chat_history_${userEmail}`);
    setMsgs([]);
  }

  return (
    <section className="flex flex-col h-[calc(100vh-180px)] rounded-2xl border border-zinc-200 bg-white p-5 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between flex-none pb-4 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <h1 className="text-lg font-semibold">{t ? t("tabs.chat") : "TimeTrack Assistant"}</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            {t ? t("brand.tagline") : "El teu company de feina virtual"}
          </p>
        </div>
        {msgs.length > 0 && (
          <button onClick={clearChat} className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300">
            {lang === "ca" ? "Neteja" : "Clear"}
          </button>
        )}
      </div>
      
      <div ref={scrollerRef} className="mt-4 flex-1 w-full overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
        {msgs.length === 0 ? (
          <div className="text-zinc-500 dark:text-zinc-400 h-full flex items-center justify-center text-center px-4">
            {loading ? "Pensant..." : "Hola! Pregunta'm per l'estat de l'equip o les vacances."}
          </div>
        ) : (
          <ul className="space-y-3">
            {msgs.map((m, i) => (
              <li key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`whitespace-pre-wrap px-4 py-2 rounded-2xl max-w-[85%] shadow-sm overflow-x-auto ${m.role === "user" ? "bg-indigo-600 text-white rounded-tr-none" : "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-tl-none border border-zinc-200"}`}>
                  {m.role === "bot" ? (
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({node, ...props}) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-2 space-y-1" {...props} />,
                        ol: ({node, ...props}) => <ol className="list-decimal pl-4 mb-2 space-y-1" {...props} />,
                        li: ({node, ...props}) => <li className="pl-1" {...props} />,
                        strong: ({node, ...props}) => <span className="font-bold text-indigo-600 dark:text-indigo-400" {...props} />,
                        table: ({node, ...props}) => (
                          <div className="overflow-x-auto my-3 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm">
                            <table className="w-full text-xs text-left border-collapse" {...props} />
                          </div>
                        ),
                        thead: ({node, ...props}) => <thead className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 uppercase font-semibold tracking-wider" {...props} />,
                        th: ({node, ...props}) => <th className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 whitespace-nowrap" {...props} />,
                        tr: ({node, ...props}) => <tr className="even:bg-zinc-50 dark:even:bg-zinc-800/50 border-b last:border-0 border-zinc-100 dark:border-zinc-800" {...props} />,
                        td: ({node, ...props}) => <td className="px-3 py-2 align-middle" {...props} />,
                      }}
                    >
                      {m.text}
                    </ReactMarkdown>
                  ) : (
                    m.text
                  )}
                </div>
              </li>
            ))}
            {loading && (
              <li className="flex gap-2">
                <div className="bg-white dark:bg-zinc-800 border border-zinc-200 px-4 py-2 rounded-2xl rounded-tl-none text-zinc-500 text-xs animate-pulse">
                   Pensant...
                </div>
              </li>
            )}
          </ul>
        )}
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row flex-none">
        <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKeyDown} placeholder="Escriu..." className="min-h-[50px] max-h-[100px] flex-1 resize-none rounded-xl border border-zinc-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-zinc-900 dark:text-white" />
        <button onClick={() => send()} disabled={loading || !input.trim()} className="h-12 rounded-xl bg-indigo-600 px-5 text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60 flex items-center justify-center">➤</button>
      </div>
    </section>
  );
}