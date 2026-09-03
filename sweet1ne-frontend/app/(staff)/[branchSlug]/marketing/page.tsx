"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe, hasPermission } from "@/lib/use-me";
import { SubscriberList } from "@/components/campaigns/marketing/subscriber-list";

export default function BranchMarketingPage({
  params,
}: {
  params: Promise<{ branchSlug: string }>;
}) {
  const { branchSlug } = use(params);
  const router = useRouter();
  const { me, loading } = useMe();
  const canManage = hasPermission(me, "manage_marketing");

  useEffect(() => {
    if (loading || !me) return;
    if (!canManage) router.replace(`/${branchSlug}/dashboard`);
  }, [me, loading, canManage, branchSlug, router]);

  if (loading || !me || !canManage) {
    return <p className="text-sm text-slate-muted">Loading…</p>;
  }

  // Sending stays central — the list covers both branches.
  return <SubscriberList tone="branch" canSendCampaigns={false} />;
}