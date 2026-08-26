"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/app/i18n";
import { apiClient } from "@/lib/api";
import type { AppSettingsRequest } from "@/schemas/api";
import LanguageSwitcher from "../../../components/LanguageSwitcher";
import Button from "@/components/ui/Button";
import { ChevronLeft, Check } from "lucide-react";

export default function AdminSettingsPage() {
  const { t } = useI18n();

  const [formData, setFormData] = useState<AppSettingsRequest>({
    defaultExpectedHours: 8,
    benevolenceHours: 1,
    endOfDayHour: 17,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const res = await apiClient.getSettings();
        if (res.error) {
          setError(t(`error.${res.error}`) || res.error || t("error.GetError"));
        } else if (res.data?.settings) {
          const s = res.data.settings;
          setFormData({
            defaultExpectedHours: s.defaultExpectedHours,
            benevolenceHours: s.benevolenceHours,
            endOfDayHour: s.endOfDayHour,
          });
        }
      } catch (err) {
        console.error("Error carregant configuració:", err);
        setError(t("error.GetError"));
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setValidationErrors([]);
    setSuccess(false);

    try {
      const response = await apiClient.updateSettings(formData);

      if (response.error) {
        if (response.error === 'ValidationError') {
          const errors = response.details.errors || [];
          if (errors.length > 0) {
            setValidationErrors(errors);
          }
          setError(t("error.ValidationError"));
        } else if (response.error === 'PutError') {
          setError(t("error.PutError"));
        } else {
          setError(t(`error.${response.error}`) || response.error || t("error.PutError"));
        }
        setSaving(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || t("error.PutError"));
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:text-white dark:focus:border-indigo-400";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="flex w-full items-center justify-between px-6 py-4">
        <Link href="/admin" className="inline-flex items-center text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
          <ChevronLeft className="mr-1 h-4 w-4" />
          {t("common.back")}
        </Link>
        <LanguageSwitcher />
      </header>

      <div className="mx-auto max-w-md px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("admin.settings.title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t("admin.settings.subtitle")}</p>
        </div>

        {loading ? (
          <div className="p-10 text-center animate-pulse text-zinc-500">{t("common.loading")}</div>
        ) : (
          <form onSubmit={handleSubmit} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}

            {validationErrors.length > 0 && (
              <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                <ul className="list-disc pl-4 space-y-1">
                  {validationErrors.map((err, index) => (
                    <li key={index}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {success && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-600 dark:bg-green-900/20 dark:text-green-400">
                <Check size={16} />
                {t("admin.settings.saved")}
              </div>
            )}

            <div className="space-y-6">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {t("admin.settings.defaultHoursLabel")}
                </label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  required
                  value={formData.defaultExpectedHours}
                  onChange={e => setFormData({ ...formData, defaultExpectedHours: parseFloat(e.target.value) || 0 })}
                  className={inputClass}
                />
                <p className="mt-1.5 text-xs text-zinc-500">{t("admin.settings.defaultHoursHelp")}</p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {t("admin.settings.benevolenceLabel")}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  required
                  value={formData.benevolenceHours}
                  onChange={e => setFormData({ ...formData, benevolenceHours: parseFloat(e.target.value) || 0 })}
                  className={inputClass}
                />
                <p className="mt-1.5 text-xs text-zinc-500">{t("admin.settings.benevolenceHelp")}</p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {t("admin.settings.endOfDayLabel")}
                </label>
                <input
                  type="number"
                  min="0"
                  max="24"
                  step="0.5"
                  required
                  value={formData.endOfDayHour}
                  onChange={e => setFormData({ ...formData, endOfDayHour: Math.min(24, Math.max(0, parseFloat(e.target.value) || 0)) })}
                  className={inputClass}
                />
                <p className="mt-1.5 text-xs text-zinc-500">{t("admin.settings.endOfDayHelp")}</p>
              </div>
            </div>

            <Button
              type="submit"
              disabled={saving}
              variant="primary"
              className="mt-8 w-full"
            >
              {saving ? t("common.saving") : t("common.save")}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}