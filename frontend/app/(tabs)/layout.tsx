import type { Metadata } from "next";
import BottomNav from "@/components/BottomNav";
import HeaderBar from "@/components/HeaderBar";

export const metadata: Metadata = {
  title: "TimeTrack360",
  description: "Registre de jornada",
};

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-zinc-50 to-white text-zinc-900 dark:from-zinc-950 dark:to-zinc-900 dark:text-zinc-100">
      {/* TOP BAR: sense contenidor i sense padding */}
      <div className="sticky top-0 z-30 border-b border-zinc-200/60 bg-white/70 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
        <div className="flex h-12 w-full items-center justify-start">
          <HeaderBar />
        </div>
      </div>

      <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-4 sm:pb-28">
        {children}
      </main>

      <BottomNav />
    </div>
  );
}