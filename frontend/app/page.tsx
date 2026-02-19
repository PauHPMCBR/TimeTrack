"use client";

import LanguageSwitcher from "@/components/LanguageSwitcher";
import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-zinc-50 to-white text-zinc-900 dark:from-zinc-950 dark:to-zinc-900 dark:text-zinc-100">
      {/* TOP BAR: sense contenidor i sense padding */}
      <div className="sticky top-0 z-30 border-b border-zinc-200/60 bg-white/70 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
        <div className="flex h-12 w-full items-center justify-start">
          <LanguageSwitcher />
        </div>
      </div>

      <main className="mx-auto flex min-h-[80dvh] w-full max-w-3xl items-center justify-center px-4">
        <LoginForm></LoginForm>
      </main>
    </div>
  );
}