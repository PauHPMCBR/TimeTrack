"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "../app/i18n";
import { apiClient } from "@/lib/api";

export default function LoginForm() {
  const router = useRouter();
  const { t } = useI18n();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiClient.login({ email, password });
      if (res.error) throw new Error(res.error);

      if (res.data) {
        if (remember) {
          localStorage.setItem("auth_token", res.data.token);
          localStorage.setItem("remembered_email", res.data.user.email);
        }
        router.push("/dashboard");
      } else {
        throw new Error("Unknown error");
      }
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="mb-6 flex flex-col items-center">
        <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
            <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <div className="text-2xl font-bold">TimeTrack360</div>
        <div className="text-xs text-zinc-500">{t("brand.tagline")}</div>
      </div>

      <h1 className="mb-4 text-center text-xl font-semibold">{t("login.title")}</h1>

      <div className="space-y-3">
        <input
          type="email"
          className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700"
          placeholder={t("login.email.placeholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <div className="relative">
          <input
            type={show ? "text" : "password"}
            className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700"
            placeholder={t("login.password.placeholder")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute inset-y-0 right-2 my-auto rounded px-2 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            {t("login.password.show")}
          </button>
        </div>

        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
          <input
            type="checkbox"
            className="accent-indigo-600"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          {t("login.remember")}
        </label>

        {error && <div className="text-center text-sm text-red-600">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? t("common.loading") : t("login.submit")}
        </button>
      </div>
    </form>
  );
}