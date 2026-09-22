"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/lib/use-me";
import { Sidebar } from "@/components/staff/sidebar";
import { AdminLoading } from "@/components/admin/admin-loading";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { me, loading } = useMe();

  useEffect(() => {
    if (loading || !me) return;
    // Only unscoped (director-level) staff belong at /admin.
    if (me.branch_id !== null) {
      router.replace(`/${me.branch_slug}/dashboard`);
    }
  }, [me, loading, router]);

  if (loading || !me || me.branch_id !== null) {
    return (
      <div className="admin-shell flex min-h-[100svh] items-center justify-center bg-[var(--bg)]">
        <AdminLoading />
      </div>
    );
  }

  return (
    <div className="admin-shell grid min-h-[100svh] grid-cols-1 bg-[var(--bg)] font-body text-[var(--ivory)] min-[961px]:grid-cols-[17rem_minmax(0,1fr)]">
      <Sidebar variant="admin" basePath="/admin" />
      <main className="min-w-0">
        <div className="admin-stage">{children}</div>
      </main>
      {/* Pages portal an .admin-drawer-edit here when they need the
          right-hand editor column; .admin-shell:has(...) in globals.css
          expands the grid to 3 columns only while one is mounted. */}
      <div id="admin-drawer-slot" />
    </div>
  );
}