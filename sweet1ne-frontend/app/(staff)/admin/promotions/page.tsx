"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useMe, hasPermission } from "@/lib/use-me";
import { PromoList } from "@/components/promos/promo-list";
import { PromotionConsole } from "@/components/promotions/promotion-console";
import { AdminLoading } from "@/components/admin/admin-loading";

type Branch = { id: string; name: string };

export default function AdminPromotionsPage() {
  const router = useRouter();
  const { me, loading } = useMe();
  const canManage = hasPermission(me, "manage_promotions");
  const [tab, setTab] = useState<"promotions" | "discounts">("promotions");
  const [branches, setBranches] = useState<Branch[]>([]);

  useEffect(() => {
    apiFetch("/branches")
      .then((list: { id: string; name: string }[]) => setBranches(list.map((b) => ({ id: b.id, name: b.name }))))
      .catch(() => setBranches([]));
  }, []);

  useEffect(() => {
    if (loading || !me) return;
    if (!canManage) router.replace("/admin/dashboard");
  }, [me, loading, canManage, router]);

  if (loading || !me || !canManage) {
    return <AdminLoading />;
  }

  return (
    <>
      <div className="admin-cats" role="group" aria-label="Section">
        <button type="button" className={tab === "promotions" ? "is-on" : undefined} onClick={() => setTab("promotions")}>
          Promotions
        </button>
        <button type="button" className={tab === "discounts" ? "is-on" : undefined} onClick={() => setTab("discounts")}>
          Item discounts
        </button>
      </div>

      {tab === "promotions" ? (
        <PromotionConsole branches={branches} meEmail={me?.email ?? null} />
      ) : (
        <PromoList tone="admin" showBranchPicker />
      )}
    </>
  );
}
