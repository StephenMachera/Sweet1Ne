"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe, hasPermission } from "@/lib/use-me";
import { AdminLoading } from "@/components/admin/admin-loading";

export default function AdminInsightsPage() {
  const router = useRouter();
  const { me, loading } = useMe();
  const canView = hasPermission(me, "access_reports");

  useEffect(() => {
    if (loading || !me) return;
    if (!canView) router.replace("/admin/dashboard");
  }, [me, loading, canView, router]);

  if (loading || !me || !canView) {
    return <AdminLoading />;
  }

  return (
    <>
      <h1>Insights</h1>
      <p className="admin-empty">Insights — coming soon.</p>
    </>
  );
}
