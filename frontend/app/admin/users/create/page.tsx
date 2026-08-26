"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/app/i18n";
import { apiClient } from "@/lib/api";
import type { CreateUserRequest } from "@/schemas/api";
import LanguageSwitcher from "../../../../components/LanguageSwitcher"; 
import Button from "@/components/ui/Button";
import { ChevronLeft, Check } from "lucide-react";

export default function CreateUserPage() {
  const { t } = useI18n(); 

  const [formData, setFormData] = useState<CreateUserRequest>({
    name: "",
    email: "",
    role: "employee",
    dni: "",
  });

  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setValidationErrors([]);
    setInviteLink(null);

    try {
      const response = await apiClient.createUser(formData);
      
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
        } else if (response.error === 'MissingParameter') {
          if (response.details.missingParameter === 'email') {
            setError(t("error.MissingParameter") + ": " + t("error.IncorrectParameter.email"));
          } else if (response.details.missingParameter === 'name') {
            setError(t("error.MissingParameter") + ": " + t("register.name"));
          }
        } else if (response.error === 'ValidationError') {
          const errors = response.details.errors || [];
          if (errors.length > 0) {
            setValidationErrors(errors);
            setError(t("error.ValidationError"));
          } else if (response.details.message) {
            setError(response.details.message);
          } else {
            setError(t("error.ValidationError"));
          }
        } else if (response.error === 'PostError') {
          setError(t("error.PostError"));
        } else {
          setError(t(`error.${response.error}`) || response.error || t("error.PostError"));
        }
        setLoading(false);
        return;
      }
      
      // 3. If all goes well, backend returns { data: { registrationLink: "..." } }
      if (response && response.data && response.data.registrationLink) {
        setInviteLink(response.data.registrationLink);
      } else {
        // Fallback if API responds OK but without link (rare case)
        setError("User created, but no invitation link was received.");
      }

    } catch (error: any) {
      console.error(error);
      setError(error.message || t("error.PostError"));
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReset = () => {
    setInviteLink(null);
    setError(null);
    setValidationErrors([]);
    setFormData({ name: "", email: "", role: "employee", dni: "" });
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      
      {/* --- TOP BAR (HEADER) --- */}
      <header className="flex w-full items-center justify-between px-6 py-4">
        <Link href="/profile" className="inline-flex items-center text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
          <ChevronLeft className="mr-1 h-4 w-4" />
          {t("common.back")}
        </Link>

        <LanguageSwitcher />
      </header>

      {/* --- MAIN CONTENT --- */}
      <div className="mx-auto max-w-md px-4 py-8">
        
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("admin.create.title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t("admin.create.subtitle")}</p>
        </div>

        {/* --- OPTION A: SHOW RESULT (LINK) --- */}
        {inviteLink ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center shadow-sm dark:border-green-900/30 dark:bg-green-900/10">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/20">
              <Check size={24} />
            </div>
            
            <h3 className="text-lg font-medium text-green-900 dark:text-green-300">
              {t("admin.success.title")}
            </h3>
            <p className="mt-1 text-sm text-green-800/80 dark:text-green-200/70 mb-6">
              {t("admin.success.desc")}
            </p>

            <div className="relative mb-4">
              <input 
                readOnly 
                value={inviteLink} 
                className="w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-sm text-zinc-600 outline-none focus:ring-2 focus:ring-green-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              />
            </div>

            <button 
              onClick={copyToClipboard}
              className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors shadow-sm"
            >
              {copied ? t("admin.copied") : t("admin.copy")}
            </button>
            
            <button 
              onClick={handleReset}
              className="mt-4 text-xs font-medium text-green-700 hover:underline dark:text-green-400"
            >
              {t("admin.createAnother")}
            </button>
          </div>
        ) : (
          /* --- OPTION B: SHOW FORM --- */
          <form onSubmit={handleSubmit} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            
            {/* Error display */}
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}

            {/* Validation errors list */}
            {validationErrors.length > 0 && (
              <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                <ul className="list-disc pl-4 space-y-1">
                  {validationErrors.map((err, index) => (
                    <li key={index}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-5">
              {/* Field: Name */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {t("admin.form.name")}
                </label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:text-white dark:focus:border-indigo-400"
                  placeholder={t("register.name")}
                />
              </div>

              {/* Field: Email */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {t("admin.form.email")}
                </label>
                <input 
                  type="email" 
                  required
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:text-white dark:focus:border-indigo-400"
                  placeholder={t("login.email.placeholder")}
                />
              </div>

              {/* Field: DNI */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {t("admin.form.dni")}
                </label>
                <input 
                  type="text" 
                  required
                  value={formData.dni ?? ""}
                  onChange={e => setFormData({...formData, dni: e.target.value})}
                  className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:text-white dark:focus:border-indigo-400"
                  placeholder={t("admin.form.dniPlaceholder")}
                />
              </div>

              {/* Field: Role */}
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {t("admin.form.role.label")}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, role: 'employee'})}
                    className={`flex flex-col items-center justify-center rounded-xl border p-3 text-sm font-medium transition-all ${
                      formData.role === 'employee' 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300 dark:ring-indigo-500' 
                        : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <span className="mb-1 text-lg"></span>
                    {t("admin.form.role.employee")}
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({...formData, role: 'admin'})}
                    className={`flex flex-col items-center justify-center rounded-xl border p-3 text-sm font-medium transition-all ${
                      formData.role === 'admin' 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300 dark:ring-indigo-500' 
                        : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <span className="mb-1 text-lg"></span>
                    {t("admin.form.role.admin")}
                  </button>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <Button 
              type="submit" 
              disabled={loading}
              variant="primary"
              className="mt-8 w-full"
            >
              {loading ? (
                  <span className="flex items-center justify-center gap-2">
                      <svg className="h-4 w-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      {t("common.loading")}
                  </span>
              ) : t("admin.btn.create")}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}