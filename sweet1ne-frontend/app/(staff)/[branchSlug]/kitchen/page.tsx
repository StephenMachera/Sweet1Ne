"use client";

import { use } from "react";
import { FloorAdminPage } from "@/components/floor/floor-admin-page";
import { useCurrentBranch } from "@/lib/use-current-branch";
import { AdminLoading } from "@/components/admin/admin-loading";

export default function KitchenPage({
  params,
}: {
  params: Promise<{ branchSlug: string }>;
}) {
  const { branchSlug } = use(params);
  const { branch, loading } = useCurrentBranch(branchSlug);

  if (loading || !branch) {
    return <AdminLoading />;
  }

  return <FloorAdminPage station="kitchen" lockedBranch={branch} basePath={`/${branchSlug}`} />;
}
