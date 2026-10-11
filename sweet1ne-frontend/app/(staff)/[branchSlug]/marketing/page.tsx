"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe, hasPermission } from "@/lib/use-me";
import { SubscriberList } from "@/components/campaigns/marketing/subscriber-list";
import { AdminLoading } from "@/components/admin/admin-loading";

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
    return <AdminLoading />;
  }

  // Sending stays central — the list covers both branches.
  return <SubscriberList tone="admin" canSendCampaigns={false} />;
}