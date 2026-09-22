"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useMe, hasPermission } from "@/lib/use-me";
import { AdminLoading } from "@/components/admin/admin-loading";

type Branch = { id: string; name: string; settings?: { order_mode?: string } };
type Table = { id: string; branch_id: string; qr_code_url: string | null };
type MainCategory = { id: string };
type SubCategory = { id: string; main_category_id: string };
type MenuItem = { id: string; title: string; price: number; picture: string | null; is_available: boolean; sub_category_id: string };
type DishInsight = { menu_item_id: string; title: string; count: number };
type DishInsights = { looked_at_most: DishInsight[]; quiet: DishInsight[]; has_data: boolean };

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

/** The same real dish, shown either as "ask a waiter" (no order button) or
   with an Add stepper — exactly the logic on the real table phone
   ([branchSlug]/order/page.tsx). Flips the instant staff toggles the
   setting, using a real dish already on the menu, never invented copy. */
function PhonePreview({ mode, sample }: { mode: "waiter" | "app"; sample: MenuItem | null }) {
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--gold-line)] bg-[#0a0a0a]">
      <div className="border-b border-[var(--gold-line)] px-3 py-1.5 text-center text-[10px] uppercase tracking-[0.14em] text-[var(--ivory-dim)]">
        Table phone preview
      </div>
      <div className="p-3">
        {sample ? (
          <div className="flex items-center gap-3 rounded-xl border border-[var(--gold-line)] bg-[#111] p-2.5">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[#1a1a1a]">
              {sample.picture && <img src={sample.picture} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-[var(--ivory)]">{sample.title}</p>
              <p className="text-xs text-[var(--gold)]">{gbp.format(sample.price)}</p>
            </div>
            {mode === "waiter" ? (
              <span className="shrink-0 text-xs text-[var(--ivory-dim)]">Ask a waiter</span>
            ) : (
              <button type="button" disabled className="shrink-0 rounded-full bg-[var(--gold)] px-3 py-1.5 text-xs font-medium text-[#0e0e0e]">
                Add
              </button>
            )}
          </div>
        ) : (
          <p className="text-center text-xs text-[var(--ivory-dim)]">No dish on yet to preview.</p>
        )}
      </div>
    </div>
  );
}

export default function AdminQrPage() {
  const router = useRouter();
  const { me, loading: meLoading } = useMe();
  const canManage = hasPermission(me, "manage_tables");

  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchFilter, setBranchFilter] = useState("");
  const [tables, setTables] = useState<Table[]>([]);
  const [mains, setMains] = useState<MainCategory[]>([]);
  const [subs, setSubs] = useState<SubCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [savingBranchId, setSavingBranchId] = useState<string | null>(null);
  const [insights, setInsights] = useState<DishInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/branches").then(setBranches).catch(() => setBranches([]));
    apiFetch("/tables").then(setTables).catch(() => setTables([]));
    Promise.all([
      apiFetch("/staff/menu/main-categories?include_inactive=true"),
      apiFetch("/staff/menu/sub-categories?include_inactive=true"),
      apiFetch("/staff/menu/menu-items?include_inactive=true"),
    ])
      .then(([m, s, i]) => {
        setMains(m);
        setSubs(s);
        setItems(i);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (meLoading || !me) return;
    if (!canManage) router.replace("/admin/dashboard");
  }, [meLoading, me, canManage, router]);

  useEffect(() => {
    apiFetch(`/promotions/dish-insights${branchFilter ? `?branch_id=${branchFilter}` : ""}`)
      .then(setInsights)
      .catch(() => setInsights(null));
  }, [branchFilter]);

  async function setOrderMode(branch: Branch, mode: "waiter" | "app") {
    setSavingBranchId(branch.id);
    setError(null);
    try {
      const updated = await apiFetch(`/branches/${branch.id}/order-mode`, {
        method: "PATCH",
        body: JSON.stringify({ order_mode: mode }),
      });
      setBranches((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change that.");
    } finally {
      setSavingBranchId(null);
    }
  }

  if (meLoading || !me || !canManage) {
    return <AdminLoading />;
  }

  const subById = new Map(subs.map((s) => [s.id, s]));
  const mainIdSet = new Set(mains.map((m) => m.id));
  const onItems = items.filter((i) => i.is_available);
  const needPicture = onItems.filter((i) => {
    const sub = subById.get(i.sub_category_id);
    return !i.picture && sub && mainIdSet.has(sub.main_category_id);
  });

  const attached = tables.filter((t) => t.qr_code_url).length;
  const visibleBranches = branches.filter((b) => !branchFilter || b.id === branchFilter);

  return (
    <>
      <div className="admin-top">
        <div className="admin-places" role="group" aria-label="Restaurant">
          <button
            type="button"
            className={branchFilter === "" ? "is-on" : undefined}
            onClick={() => setBranchFilter("")}
          >
            Both
          </button>
          {branches.map((b) => (
            <button
              key={b.id}
              type="button"
              className={branchFilter === b.id ? "is-on" : undefined}
              onClick={() => setBranchFilter(branchFilter === b.id ? "" : b.id)}
            >
              {b.name}
            </button>
          ))}
        </div>
        <p className="admin-who">{me?.email ?? "—"}</p>
      </div>

      <h1>QR Codes</h1>
      <p className="admin-dek">
        The phone always shows the menu. Choose who takes the order — a waiter, or the phone.
      </p>

      {error && <p className="admin-hold mb-3 text-sm">{error}</p>}

      <div className="admin-kpi-strip" aria-label="Summary">
        <div>
          <span className="admin-kpi-n">{tables.length}</span>
          <span className="admin-kpi-l">Tables</span>
        </div>
        <div>
          <span className="admin-kpi-n">{attached}</span>
          <span className="admin-kpi-l">With a code</span>
        </div>
        <div>
          <span className="admin-kpi-n">{onItems.length}</span>
          <span className="admin-kpi-l">Dishes on</span>
        </div>
        <div>
          <span className="admin-kpi-n">{needPicture.length}</span>
          <span className="admin-kpi-l">Need a picture</span>
        </div>
      </div>

      <div className="admin-board-group">
        <h2>How they order</h2>
        <p className="admin-dek">
          Ask a waiter keeps people with the floor. Order on the phone lets guests order straight
          from the table.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {visibleBranches.map((branch) => {
            const mode = branch.settings?.order_mode === "app" ? "app" : "waiter";
            const saving = savingBranchId === branch.id;
            return (
              <article key={branch.id} className="admin-card">
                <h2>{branch.name}</h2>
                <p className="admin-stat">{mode === "app" ? "On the phone" : "Ask a waiter"}</p>
                <p>
                  {mode === "app"
                    ? "Guests order on the phone at the table."
                    : "Guests see the menu, then a waiter takes the order."}
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setOrderMode(branch, "waiter")}
                    className={`rounded-[3px] border p-3 text-left text-sm transition-colors ${
                      mode === "waiter"
                        ? "border-[var(--gold)] bg-[rgba(201,162,74,0.1)] text-[var(--ivory)]"
                        : "border-[var(--gold-line)] text-[var(--ivory-dim)] hover:text-[var(--ivory)]"
                    }`}
                  >
                    <strong className="block">Ask a waiter</strong>
                    <span className="text-xs">Floor takes the order</span>
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setOrderMode(branch, "app")}
                    className={`rounded-[3px] border p-3 text-left text-sm transition-colors ${
                      mode === "app"
                        ? "border-[var(--gold)] bg-[rgba(201,162,74,0.1)] text-[var(--ivory)]"
                        : "border-[var(--gold-line)] text-[var(--ivory-dim)] hover:text-[var(--ivory)]"
                    }`}
                  >
                    <strong className="block">Order on the phone</strong>
                    <span className="text-xs">Guests order themselves</span>
                  </button>
                </div>
                <PhonePreview mode={mode} sample={onItems[0] ?? null} />
              </article>
            );
          })}
        </div>
      </div>

      <section className="admin-board tight" aria-label="What guests scan">
        <article className="admin-card">
          <h2>Phone menu</h2>
          <p className="admin-stat">Live</p>
          <p>Every table&rsquo;s code opens the real menu — no separate link to attach.</p>
          <div className="admin-acts">
            <Link className="admin-act" href="/admin/menu/manage">
              Menu
            </Link>
            <Link className="admin-act" href="/admin/media">
              Media
            </Link>
          </div>
        </article>
        <article className={needPicture.length > 0 ? "admin-card is-wait" : "admin-card"}>
          <h2>Pictures for the phone</h2>
          <p className={needPicture.length > 0 ? "admin-stat admin-hold" : "admin-stat"}>
            {needPicture.length}
          </p>
          <p>A dish without a picture still lists. Guests see it better with one.</p>
          <div className="admin-acts">
            <Link className="admin-act" href="/admin/menu/manage">
              Open menu
            </Link>
          </div>
        </article>
      </section>

      {needPicture.length > 0 && (
        <div className="admin-board-group">
          <h2>Need a picture</h2>
          <div className="admin-data-panel">
            <table className="admin-sheet">
              <thead>
                <tr>
                  <th>Dish</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {needPicture.slice(0, 8).map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className="admin-name">{item.title}</span>
                    </td>
                    <td>
                      <Link className="admin-edit" href="/admin/menu/manage">
                        Add picture
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {needPicture.length > 8 && (
            <p className="mt-2 text-xs text-[var(--ivory-dim)]">
              {needPicture.length - 8} more —{" "}
              <Link className="admin-edit" href="/admin/menu/manage">
                see all
              </Link>
            </p>
          )}
        </div>
      )}

      <div className="admin-board-group">
        <h2>What guests notice</h2>
        <p className="admin-dek">
          {insights?.has_data
            ? "From real taps on the table phone — the staff preview never counts."
            : "Empty until a real guest opens or adds a dish on the table phone — the staff preview never counts."}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <article className="admin-card">
            <h2>Looked at most</h2>
            {insights && insights.looked_at_most.length > 0 ? (
              <ol className="mt-1 space-y-1 text-sm text-[var(--ivory)]">
                {insights.looked_at_most.map((d) => (
                  <li key={d.menu_item_id} className="flex items-center justify-between">
                    <span>{d.title}</span>
                    <span className="text-[var(--ivory-dim)]">{d.count}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p>Nothing yet.</p>
            )}
          </article>
          <article className="admin-card">
            <h2>Quiet on the phone</h2>
            {insights && insights.quiet.length > 0 ? (
              <ol className="mt-1 space-y-1 text-sm text-[var(--ivory-dim)]">
                {insights.quiet.map((d) => (
                  <li key={d.menu_item_id}>{d.title}</li>
                ))}
              </ol>
            ) : (
              <p>Nothing yet.</p>
            )}
          </article>
        </div>
      </div>

      <div className="admin-board-group">
        <h2>Table codes</h2>
        <p className="admin-dek">
          {loading
            ? "Loading…"
            : `${tables.length} table${tables.length === 1 ? "" : "s"} · ${attached} with a code. Attach a code, print it, or override how one table orders on Tables.`}
        </p>
        <Link className="admin-edit" href="/admin/tables">
          Tables
        </Link>
      </div>
    </>
  );
}
