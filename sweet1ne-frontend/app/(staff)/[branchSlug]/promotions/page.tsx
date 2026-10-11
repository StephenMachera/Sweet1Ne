"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useMe, hasPermission } from "@/lib/use-me";
import { PromoList } from "@/components/promos/promo-list";
import { PromotionConsole } from "@/components/promotions/promotion-console";
import { AdminLoading } from "@/components/admin/admin-loading";

type Branch = { id: string; name: string; slug: string };
type Table = { id: string; branch_id: string; qr_token: string };

export default function AdminPromotionsPage() {
  const router = useRouter();
  const { me, loading } = useMe();
  const canManage = hasPermission(me, "manage_promotions");
  const [tab, setTab] = useState<"promotions" | "discounts">("promotions");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [tables, setTables] = useState<Table[]>([]);

  useEffect(() => {
    apiFetch("/branches")
      .then((list: { id: string; name: string; slug: string }[]) =>
        setBranches(list.map((b) => ({ id: b.id, name: b.name, slug: b.slug })))
      )
      .catch(() => setBranches([]));
    // A real table's QR token — only to render the actual guest menu
    // behind the "QR app" preview, never used for anything but that.
    apiFetch("/tables")
      .then((list: { id: string; branch_id: string; qr_token: string }[]) =>
        setTables(list.map((t) => ({ id: t.id, branch_id: t.branch_id, qr_token: t.qr_token })))
      )
      .catch(() => setTables([]));
  }, []);

  useEffect(() => {
    if (loading || !me) return;
    if (!canManage) router.replace("/admin/dashboard");
  }, [me, loading, canManage, router]);

  if (loading || !me || !canManage) {
    return <AdminLoading />;
  }

  return tab === "promotions" ? (
    <PromotionConsole
      branches={branches}
      tables={tables}
      meEmail={me?.email ?? null}
      onShowDiscounts={() => setTab("discounts")}
    />
  ) : (
    <>
      <div className="admin-top">
        <button
          type="button"
          className="admin-secondary-link"
          onClick={() => setTab("promotions")}
        >
          Back to promotions
        </button>
      </div>
      <PromoList tone="admin" showBranchPicker />
    </>
  );
}
