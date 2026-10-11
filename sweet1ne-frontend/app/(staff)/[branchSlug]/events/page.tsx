"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe, hasPermission } from "@/lib/use-me";
import { EventList } from "@/components/events/event-list";
import { AdminLoading } from "@/components/admin/admin-loading";

export default function BranchEventsPage({
  params,
}: {
  params: Promise<{ branchSlug: string }>;
}) {
  const { branchSlug } = use(params);
  const router = useRouter();
  const { me, loading } = useMe();
  const canManage = hasPermission(me, "manage_promotions");

  useEffect(() => {
    if (loading || !me) return;
    if (!canManage) router.replace(`/${branchSlug}/dashboard`);
  }, [me, loading, canManage, branchSlug, router]);

  if (loading || !me || !canManage) {
    return <AdminLoading />;
  }

  return <EventList tone="branch" showBranchPicker={false} />;
}