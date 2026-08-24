"use client";

import { use } from "react";
import { Martini } from "lucide-react";
import { StationScreen } from "@/components/station/station-screen";

export default function BarPage({
  params,
}: {
  params: Promise<{ branchSlug: string }>;
}) {
  const { branchSlug } = use(params);

  return (
    <StationScreen
      station="bar"
      title="Bar"
      icon={Martini}
      accessPermission="access_bar"
      branchSlug={branchSlug}
      labels={{
        arrived: "Orders in",
        active: "Pouring",
        activeAction: "Ready to collect",
        done: "Ready & collected",
      }}
    />
  );
}