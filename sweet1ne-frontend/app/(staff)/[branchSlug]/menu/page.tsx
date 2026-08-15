"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useMe, hasPermission } from "@/lib/use-me";
import { MenuBrowser, type CartLine } from "@/components/menu/menu-browser";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Table = { id: string; number: number; region: string | null; seats: number };

export default function BranchMenuPage({
  params,
}: {
  params: Promise<{ branchSlug: string }>;
}) {
  const { branchSlug } = use(params);
  const router = useRouter();
  const { me, loading: meLoading } = useMe();

  const [tables, setTables] = useState<Table[]>([]);
  const [tableId, setTableId] = useState("");
  const [seatNumber, setSeatNumber] = useState("");
  const [specialRequest, setSpecialRequest] = useState("");
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const canView = hasPermission(me, "view_menu");
  const canEdit = hasPermission(me, "edit_menu");
  const canOrder = hasPermission(me, "place_orders");

  useEffect(() => {
    if (meLoading || !me) return;
    if (!canView) {
      router.replace("/login");
      return;
    }
    // Edit-capable staff belong on the management view.
    if (canEdit) router.replace(`/${branchSlug}/menu/manage`);
  }, [meLoading, me, canView, canEdit, branchSlug, router]);

  useEffect(() => {
    if (!canOrder) return;
    apiFetch("/tables").then(setTables).catch(() => setTables([]));
  }, [canOrder]);

  const fetcher = useCallback((path: string) => apiFetch(`/staff/menu${path}`), []);

  async function submitOrder(lines: CartLine[]) {
    if (!tableId) throw new Error("Please choose a table first.");
    await apiFetch("/staff/orders", {
      method: "POST",
      body: JSON.stringify({
        table_id: tableId,
        seat_number: seatNumber ? Number(seatNumber) : null,
        special_request: specialRequest || null,
        items: lines,
      }),
    });
    setSeatNumber("");
    setSpecialRequest("");
    setConfirmation("Order sent to the kitchen.");
    setTimeout(() => setConfirmation(null), 4000);
  }

  if (meLoading || !me || !canView || canEdit) {
    return <p className="text-sm text-slate-muted">Loading…</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-semibold text-navy max-md:hidden">Menu</h1>
        {canOrder && (
          <p className="mt-1 text-sm text-slate-subtle">
            Pick a table, add items, then send the order.
          </p>
        )}
      </div>

      {confirmation && (
        <div className="rounded-xl border border-success/25 bg-success-bg px-4 py-3 text-sm text-success">
          {confirmation}
        </div>
      )}

      <MenuBrowser
        mode={canOrder ? "ordering" : "preview"}
        fetcher={fetcher}
        onSubmitOrder={canOrder ? submitOrder : undefined}
        headerSlot={
          canOrder ? (
            <div className="grid gap-3 rounded-xl border border-slate-bg bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="table">Table</Label>
                <select
                  id="table"
                  value={tableId}
                  onChange={(e) => setTableId(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-border bg-white px-3 text-sm"
                >
                  <option value="">Choose a table…</option>
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>
                      Table {t.number}
                      {t.region ? ` · ${t.region}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="seat">Seat (optional)</Label>
                <Input
                  id="seat"
                  type="number"
                  min="1"
                  value={seatNumber}
                  onChange={(e) => setSeatNumber(e.target.value)}
                  className="h-10 border-slate-border"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="request">Special request</Label>
                <Input
                  id="request"
                  value={specialRequest}
                  onChange={(e) => setSpecialRequest(e.target.value)}
                  className="h-10 border-slate-border"
                />
              </div>
            </div>
          ) : null
        }
      />
    </div>
  );
}