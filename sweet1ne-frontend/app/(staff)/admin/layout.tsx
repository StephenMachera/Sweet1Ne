"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/lib/use-me";
import { Sidebar } from "@/components/staff/sidebar";

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
      <div className="flex min-h-screen items-center justify-center bg-[#F7F8FA]">
        <p className="text-sm text-ink-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F7F8FA]">
      <Sidebar variant="admin" basePath="/admin" />
      <main className="flex-1 px-6 py-8 max-md:pt-20 md:px-10">{children}</main>
    </div>
  );
}