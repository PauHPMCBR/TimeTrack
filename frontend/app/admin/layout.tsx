import BottomNav from "@/components/BottomNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 pb-24 dark:bg-zinc-950">
      {children}
      <BottomNav />
    </div>
  );
}