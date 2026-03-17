"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/app/i18n";
import { apiClient } from "@/lib/api";
import LanguageSwitcher from "../../../components/LanguageSwitcher";

export default function CompleteRegistrationPage() {
  const { t } = useI18n();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const token = params.token as string;
  
  // Read data from link if available
  const urlEmail = searchParams.get('email') || "";
  const urlName = searchParams.get('name') || "";

  const [formData, setFormData] = useState({
    email: urlEmail,
    name: urlName,
    password: "",
    confirmPassword: ""
  });

  // Update fields if URL loads late
  useEffect(() => {
    if (urlEmail || urlName) {
      setFormData(prev => ({ ...prev, email: urlEmail, name: urlName }));
    }
  }, [urlEmail, urlName]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPasswordErrors([]);

    if (formData.password !== formData.confirmPassword) {
      setError(t("register.error.match"));
      return;
    }
    if (formData.password.length < 12) {
      setError(t("error.IncorrectParameter.reason.LessThan12Characters"));
      return;
    }

    setLoading(true);

    try {
      const res = await apiClient.register({
        registrationToken: token,
        email: formData.email,
        name: formData.name,
        password: formData.password
      });

      if (res.error) {
        // Handle structured errors
        if (res.error === 'IncorrectParameter') {
          if (res.details.incorrectParameter === 'email') {
            setError(t("error.IncorrectParameter.email") + " - " + t("error.IncorrectParameter"));
          } else if (res.details.incorrectParameter === 'password') {
            // Show password validation errors
            const reasons = res.details.reasons || [];
            const errorMessages = reasons.map((reason: string) => 
              t(`error.IncorrectParameter.reason.${reason}`)
            );
            setPasswordErrors(errorMessages);
            setError(t("error.IncorrectParameter.password") + " " + t("error.IncorrectParameter"));
          }
        } else if (res.details.error === 'InvalidRegisterToken') {
          setError(t("error.InvalidRegisterToken"));
        } else if (res.details.error === 'MissingParameter') {
          if (res.details.missingParameter === 'password') {
            setError(t("error.MissingParameter") + ": " + t("error.IncorrectParameter.password"));
          }
        } else if (res.error === 'PostError') {
          setError(t("error.PostError"));
        } else {
          // Generic error handling
          setError(t(`error.${res.error}`) || res.error || t("error.PostError"));
        }
        return;
      }
      
      if (res.data && res.data.token) {
        localStorage.setItem('auth_token', res.data.token);
        // Use a non-blocking way to show success or just redirect
        window.location.href = "/profile";
      } else {
        router.push("/login");
      }

    } catch (err: any) {
      console.error(err);
      // Fallback error handling
      if (err.message?.includes("MissingUppercase")) setError(t("error.IncorrectParameter.reason.MissingUppercase"));
      else if (err.message?.includes("MissingLowercase")) setError(t("error.IncorrectParameter.reason.MissingLowercase"));
      else if (err.message?.includes("MissingNumber")) setError(t("error.IncorrectParameter.reason.MissingNumber"));
      else if (err.message?.includes("MissingSign")) setError(t("error.IncorrectParameter.reason.MissingSign"));
      else if (err.message?.includes("email")) setError(t("error.IncorrectParameter.email") + " - " + t("error.IncorrectParameter"));
      else setError(err.message || t("error.PostError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      
      {/* HEADER WITH LANGUAGE SWITCHER (LEFT) */}
      <header className="flex w-full justify-start px-6 py-4">
        <LanguageSwitcher />
      </header>

      {/* MAIN CONTENT */}
      <div className="flex flex-1 items-center justify-center px-4 pb-20">
        <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("register.welcome")}</h1>
            <p className="mt-2 text-sm text-zinc-500">{t("register.subtitle")}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* 1. NAME FIELD */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {t("register.name")}
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:text-white"
              />
            </div>

            {/* 2. EMAIL FIELD */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {t("register.email")}
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:text-white"
              />
            </div>

            {/* 3. PASSWORD */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {t("register.password")}
              </label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:text-white"
              />
            </div>

            {/* 4. CONFIRM PASSWORD */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {t("register.confirm")}
              </label>
              <input
                type="password"
                required
                value={formData.confirmPassword}
                onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:text-white"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}

            {/* Password-specific errors */}
            {passwordErrors.length > 0 && (
              <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                <ul className="list-disc pl-4 space-y-1">
                  {passwordErrors.map((err, index) => (
                    <li key={index}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-md hover:bg-indigo-700 disabled:opacity-70 transition-colors"
            >
              {loading ? t("register.saving") : t("register.btn")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}