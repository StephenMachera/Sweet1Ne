"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe, hasPermission } from "@/lib/use-me";
import { SubscriberList } from "@/components/campaigns/marketing/subscriber-list";

export default function AdminMarketingPage() {
  const router = useRouter();
  const { me, loading } = useMe();
  const canManage = hasPermission(me, "manage_marketing");

  useEffect(() => {
    if (loading || !me) return;
    if (!canManage) router.replace("/admin/dashboard");
  }, [me, loading, canManage, router]);

  if (loading || !me || !canManage) {
    return <p className="text-sm text-ink-muted">Loading…</p>;
  }

  return <SubscriberList tone="admin" canSendCampaigns />;
}