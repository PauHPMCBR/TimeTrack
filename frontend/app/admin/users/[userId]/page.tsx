"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useI18n } from "@/app/i18n";
import { apiClient } from "@/lib/api";
import { User } from "@/types";
import type { UpdateUserRequest } from "@/schemas/api";
import LanguageSwitcher from "../../../../components/LanguageSwitcher";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { ChevronLeft, Check } from "lucide-react";

export default function EditUserPage() {
  const { t } = useI18n();
  const params = useParams<{ userId: string }>();
  const userId = params?.userId;

  const [user, setUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UpdateUserRequest>({
    name: "",
    email: "",
    role: "employee",
    dni: "",
    expectedWorkHours: 8,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      if (!userId) return;
      try {
        setLoading(true);
        const res = await apiClient.getProfile(userId);
        if (res.error) {
          setError(t(`error.${res.error}`) || res.error || t("error.GetError"));
        } else if (res.data) {
          const u = (res.data.user || res.data) as User;
          setUser(u);
          setFormData({
            name: u.name,
            email: u.email,
            role: u.role,
            dni: u.dni ?? "",
            expectedWorkHours: u.expectedWorkHours ?? 8,
          });
        }
      } catch (err) {
        console.error("Error carregant usuari:", err);
        setError(t("error.GetError"));
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [userId, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setValidationErrors([]);
    setSuccess(false);

    try {
      const response = await apiClient.updateUser(userId, formData);

      if (response.error) {
        if (response.error === 'IncorrectParameter') {
          if (response.details.incorrectParameter === 'email') {
            if (response.details.reasons?.includes('AlreadyExists')) {
              setError(t("error.IncorrectParameter.reason.AlreadyExists"));
            } else {
              setError(t("error.IncorrectParameter.email") + " - " + t("error.IncorrectParameter.message"));
            }
          } else {
            setError(t("error.IncorrectParameter.message"));
          }
        } else if (response.error === 'ValidationError') {
          const errors = response.details.errors || [];
          if (errors.length > 0) {
            setValidationErrors(errors);
            setError(t("error.ValidationError"));
          } else {
            setError(t("error.ValidationError"));
          }
        } else if (response.error === 'PutError') {
          setError(t("error.PutError"));
        } else {
          setError(t(`error.${response.error}`) || response.error || t("error.PutError"));
        }
        setSaving(false);
        return;
      }

      setSuccess(true);
      if (response.data?.user) {
        setUser(response.data.user);
      }
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || t("error.PutError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="flex w-full items-center justify-between px-6 py-4">
        <Link href="/admin/users" className="inline-flex items-center text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
          <ChevronLeft className="mr-1 h-4 w-4" />
          {t("common.back")}
        </Link>
        <LanguageSwitcher />
      </header>

      <div className="mx-auto max-w-md px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("admin.usersEdit.title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t("admin.usersEdit.subtitle")}</p>
        </div>

        {loading ? (
          <div className="p-10 text-center animate-pulse text-zinc-500">{t("common.loading")}</div>
        ) : !user ? (
          <Card className="p-8 text-center text-sm text-zinc-500">{t("profile.notFound")}</Card>
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
                {t("admin.usersEdit.saved")}
              </div>
            )}

            <div className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {t("admin.form.name")}
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:text-white dark:focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {t("admin.form.email")}
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:text-white dark:focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {t("admin.form.dni")}
                </label>
                <input
                  type="text"
                  required
                  value={formData.dni ?? ""}
                  onChange={e => setFormData({ ...formData, dni: e.target.value })}
                  className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:text-white dark:focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {t("admin.form.expectedHours")}
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  required
                  value={formData.expectedWorkHours}
                  onChange={e => setFormData({ ...formData, expectedWorkHours: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:text-white dark:focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {t("admin.form.role.label")}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: 'employee' })}
                    className={`flex flex-col items-center justify-center rounded-xl border p-3 text-sm font-medium transition-all ${
                      formData.role === 'employee'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300 dark:ring-indigo-500'
                        : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {t("admin.form.role.employee")}
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: 'admin' })}
                    className={`flex flex-col items-center justify-center rounded-xl border p-3 text-sm font-medium transition-all ${
                      formData.role === 'admin'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300 dark:ring-indigo-500'
                        : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {t("admin.form.role.admin")}
                  </button>
                </div>
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