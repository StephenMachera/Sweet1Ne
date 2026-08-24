"use client";

import { use } from "react";
import { ChefHat } from "lucide-react";
import { StationScreen } from "@/components/station/station-screen";

export default function KitchenPage({
  params,
}: {
  params: Promise<{ branchSlug: string }>;
}) {
  const { branchSlug } = use(params);

  return (
    <StationScreen
      station="kitchen"
      title="Kitchen"
      icon={ChefHat}
      accessPermission="access_kitchen"
      branchSlug={branchSlug}
      labels={{
        arrived: "Arrived",
        active: "Preparing",
        activeAction: "Ready to serve",
        done: "Ready & served",
      }}
    />
  );
}