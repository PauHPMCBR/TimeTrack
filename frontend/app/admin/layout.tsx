import BottomNav from "@/components/BottomNav";
import RequireAuth from "@/components/RequireAuth";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth requireAdmin>
      <div className="min-h-screen bg-zinc-50 pb-24 dark:bg-zinc-950">
        {children}
        <BottomNav />
      </div>
    </RequireAuth>
  );
}