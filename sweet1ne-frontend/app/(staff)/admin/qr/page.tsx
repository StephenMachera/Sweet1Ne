"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useMe, hasPermission } from "@/lib/use-me";
import { AdminLoading } from "@/components/admin/admin-loading";

const LOGO_SRC = "/images/brand/logo.png";

type Branch = { id: string; name: string; slug: string; settings?: { order_mode?: string; phone_menu_url?: string } };
type Table = {
  id: string;
  branch_id: string;
  number: number;
  qr_token: string;
  qr_code_url: string | null;
  is_active: boolean;
  order_mode: string | null;
};
type MainCategory = { id: string };
type SubCategory = { id: string; main_category_id: string };
type MenuItem = { id: string; title: string; price: number; picture: string | null; is_available: boolean; sub_category_id: string };
type DishInsight = { menu_item_id: string; title: string; count: number; views: number; adds: number };
type DishInsights = { looked_at_most: DishInsight[]; quiet: DishInsight[]; has_data: boolean };

/** The real guest ordering page, live, in an actual phone-shaped frame —
   not a hand-built replica, so it can never drift from what a guest
   actually sees. Needs one real active table to point at; a branch with
   none yet gets an honest "add a table first" message instead of a fake
   preview. reloadToken forces a fresh load (a new qr_token-scoped session,
   re-reading order_mode from the server) whenever staff flips waiter/phone
   for this branch — otherwise the iframe would keep showing whatever mode
   was live when it first loaded. */
function LivePhonePreview({ branch, table, reloadToken }: { branch: Branch; table: Table | null; reloadToken: number }) {
  if (!table) {
    return (
      <div className="admin-handset-empty">
        Add an active table on Tables to preview the phone for {branch.name}.
      </div>
    );
  }

  const src = `/${branch.slug}/order?table=${table.qr_token}&_r=${reloadToken}`;

  return (
    <div className="admin-handset-viewport">
      <iframe key={src} src={src} title={`Live table phone — ${branch.name}`} className="admin-handset-frame" />
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
  const [busyTableId, setBusyTableId] = useState<string | null>(null);
  const [insights, setInsights] = useState<DishInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [phoneUrlDraft, setPhoneUrlDraft] = useState("");
  const [savingPhoneUrl, setSavingPhoneUrl] = useState(false);

  const load = () => {
    apiFetch("/branches").then(setBranches).catch(() => setBranches([]));
    apiFetch("/tables").then(setTables).catch(() => setTables([]));
  };

  useEffect(() => {
    load();
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

  useEffect(() => {
    const branch = branches.find((b) => b.id === branchFilter) ?? branches[0] ?? null;
    setPhoneUrlDraft(branch?.settings?.phone_menu_url ?? "");
  }, [branches, branchFilter]);

  async function saveBranchPhoneUrl(branch: Branch) {
    setSavingPhoneUrl(true);
    setError(null);
    try {
      const updated = await apiFetch(`/branches/${branch.id}/phone-menu-url`, {
        method: "PATCH",
        body: JSON.stringify({ phone_menu_url: phoneUrlDraft.trim() }),
      });
      setBranches((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      setSavingPhoneUrl(false);
    }
  }

  async function setOrderMode(branch: Branch, mode: "waiter" | "app") {
    setSavingBranchId(branch.id);
    setError(null);
    try {
      const updated = await apiFetch(`/branches/${branch.id}/order-mode`, {
        method: "PATCH",
        body: JSON.stringify({ order_mode: mode }),
      });
      setBranches((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      setReloadToken((t) => t + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change that.");
    } finally {
      setSavingBranchId(null);
    }
  }

  async function toggleTableActive(table: Table) {
    setError(null);
    try {
      const updated = await apiFetch(`/tables/${table.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !table.is_active }),
      });
      setTables((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change that.");
    }
  }

  async function attachCode(table: Table) {
    setBusyTableId(table.id);
    setError(null);
    try {
      const updated = await apiFetch(`/tables/${table.id}/qr`, { method: "POST" });
      setTables((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't generate a code right now.");
    } finally {
      setBusyTableId(null);
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
  const withPicture = onItems.filter((i) => i.picture).length;

  const attached = tables.filter((t) => t.qr_code_url).length;
  const branchById = new Map(branches.map((b) => [b.id, b]));
  const visibleBranches = branches.filter((b) => !branchFilter || b.id === branchFilter);

  // The one handset shown at a time — whichever branch is filtered, else
  // the first branch, same "default to the first real one" idea as the
  // reference build defaulting to Lewisham.
  const previewBranch = branches.find((b) => b.id === branchFilter) ?? branches[0] ?? null;
  const previewTable = previewBranch
    ? tables.find((t) => t.branch_id === previewBranch.id && t.is_active) ?? null
    : null;
  const guestUrl = previewBranch && previewTable ? `/${previewBranch.slug}/order?table=${previewTable.qr_token}` : null;

  const visibleTables = tables
    .filter((t) => !branchFilter || t.branch_id === branchFilter)
    .sort((a, b) => {
      const an = branchById.get(a.branch_id)?.name ?? "";
      const bn = branchById.get(b.branch_id)?.name ?? "";
      if (an !== bn) return an.localeCompare(bn);
      return a.number - b.number;
    });

  function tableOrderLabel(table: Table): { text: string; own: boolean } {
    const own = table.order_mode === "app" || table.order_mode === "waiter";
    const branch = branchById.get(table.branch_id);
    const mode = own ? table.order_mode : branch?.settings?.order_mode === "app" ? "app" : "waiter";
    return { text: mode === "app" ? "Phone" : "Waiter", own };
  }

  function codeStatus(table: Table): { text: string; cls: string } {
    if (!table.is_active) return { text: "Off", cls: "admin-status" };
    if (table.qr_code_url) return { text: "Attached", cls: "admin-status is-ok" };
    return { text: "No code", cls: "admin-status is-wait" };
  }

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
        One mini phone. Choose who takes the order — a waiter, or the phone. Looked at most fills
        in after guests use it.
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
          <span className="admin-kpi-n">{withPicture}</span>
          <span className="admin-kpi-l">With pictures</span>
        </div>
      </div>

      <div className="admin-qr-desk">
        <section className="admin-handset" aria-label="Table phone">
          <div className="admin-handset-bar">
            <img src={LOGO_SRC} alt="Sweet1NE" />
            <p>
              {previewBranch ? `${previewBranch.name} · Table ${previewTable ? previewTable.number : "—"}` : "No branch yet"}
            </p>
          </div>
          {previewBranch ? (
            <LivePhonePreview branch={previewBranch} table={previewTable} reloadToken={reloadToken} />
          ) : (
            <div className="admin-handset-empty">Add a restaurant to preview the phone.</div>
          )}
        </section>

        <div>
          <h2 className="admin-board-h">How they order</h2>
          <p className="admin-dek">Gold is the live mode. The basket at the bottom of the phone changes with it.</p>
          <div>
            {visibleBranches.map((branch) => {
              const mode = branch.settings?.order_mode === "app" ? "app" : "waiter";
              const saving = savingBranchId === branch.id;
              return (
                <div key={branch.id} className="admin-order-row">
                  <h2>{branch.name}</h2>
                  <div className="admin-choice" role="group" aria-label={branch.name}>
                    <button
                      type="button"
                      disabled={saving}
                      className={mode === "waiter" ? "is-on" : undefined}
                      onClick={() => setOrderMode(branch, "waiter")}
                    >
                      <strong>Ask a waiter</strong>
                      <span>Floor takes the order</span>
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      className={mode === "app" ? "is-on" : undefined}
                      onClick={() => setOrderMode(branch, "app")}
                    >
                      <strong>Order on the phone</strong>
                      <span>Hold before Toast</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <nav className="admin-tile-row" aria-label="Open">
            <Link
              className="admin-tile"
              href={guestUrl ? `${guestUrl}&preview=signin` : "#"}
              target={guestUrl ? "_blank" : undefined}
              aria-disabled={!guestUrl}
              onClick={(e) => !guestUrl && e.preventDefault()}
              style={!guestUrl ? { opacity: 0.5, pointerEvents: "none" } : undefined}
            >
              <strong>Guest sign-in</strong>
              <span>Email at the table</span>
            </Link>
            <Link
              className="admin-tile"
              href={guestUrl ?? "#"}
              target={guestUrl ? "_blank" : undefined}
              aria-disabled={!guestUrl}
              onClick={(e) => !guestUrl && e.preventDefault()}
              style={!guestUrl ? { opacity: 0.5, pointerEvents: "none" } : undefined}
            >
              <strong>Guest phone</strong>
              <span>The live table app</span>
            </Link>
            <Link className="admin-tile" href="/admin/menu/manage">
              <strong>Menu</strong>
              <span>Dishes and photos</span>
            </Link>
            <Link className="admin-tile" href="/admin/promotions">
              <strong>Promotions</strong>
              <span>Codes on the basket</span>
            </Link>
            <Link className="admin-tile" href="/admin/leads">
              <strong>Leads</strong>
              <span>Who signed in</span>
            </Link>
          </nav>

          <div className="admin-qr-quiet">
            <p className="admin-kicker">Need a picture</p>
            <p className="admin-dek">
              {needPicture.length === 0 ? "Every dish on the menu has a picture." : ""}
            </p>
            <ul className="admin-need-list">
              {needPicture.slice(0, 6).map((item) => (
                <li key={item.id}>
                  <span>{item.title}</span>
                  <Link className="admin-edit" href="/admin/menu/manage">
                    Add
                  </Link>
                </li>
              ))}
              {needPicture.length > 6 && (
                <li>
                  <span />
                  <Link className="admin-edit" href="/admin/menu/manage">
                    {needPicture.length - 6} more on Menu
                  </Link>
                </li>
              )}
            </ul>
          </div>

          <div className="admin-taste-desk">
            <div>
              <p className="admin-kicker">Looked at most</p>
              <p className="admin-dek">
                {!insights || insights.looked_at_most.length === 0 ? "Empty until someone uses the table phone." : ""}
              </p>
              <ul className="admin-need-list">
                {(insights?.looked_at_most ?? []).slice(0, 6).map((d) => (
                  <li key={d.menu_item_id}>
                    <span>{d.title}</span>
                    <span className="admin-muted">
                      {d.adds ? `${d.adds} added` : ""}
                      {d.adds && d.views ? " · " : ""}
                      {d.views ? `${d.views} seen` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="admin-kicker">Quiet on the phone</p>
              <p className="admin-dek">
                {!insights || insights.quiet.length === 0 ? "On the menu, not added from the phone." : ""}
              </p>
              <ul className="admin-need-list">
                {(insights?.quiet ?? []).slice(0, 6).map((d) => (
                  <li key={d.menu_item_id}>
                    <span>{d.title}</span>
                    <Link className="admin-edit" href="/admin/promotions">
                      Lift
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {previewBranch && (
            <details className="admin-drawer-fold">
              <summary>Phone link</summary>
              <p className="admin-dek">
                {phoneUrlDraft.trim()
                  ? "Guests can use this link to order without scanning a table."
                  : "Paste when the live URL exists. Do not invent one."}
              </p>
              <form
                className="admin-tools"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveBranchPhoneUrl(previewBranch);
                }}
              >
                <input
                  type="url"
                  placeholder="Phone menu URL"
                  value={phoneUrlDraft}
                  onChange={(e) => setPhoneUrlDraft(e.target.value)}
                />
                <button type="submit" className="admin-book" disabled={savingPhoneUrl}>
                  {savingPhoneUrl ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  className="admin-edit"
                  disabled={!phoneUrlDraft.trim()}
                  onClick={() => navigator.clipboard?.writeText(phoneUrlDraft.trim())}
                >
                  Copy
                </button>
                <button
                  type="button"
                  className="admin-edit"
                  disabled={!phoneUrlDraft.trim()}
                  onClick={() => window.open(phoneUrlDraft.trim(), "_blank")}
                >
                  Print
                </button>
              </form>
            </details>
          )}
        </div>
      </div>

      <h2 className="admin-board-h">Table codes</h2>
      <p className="admin-dek">
        {loading
          ? "Loading…"
          : tables.length
            ? `${tables.length} table${tables.length === 1 ? "" : "s"} · ${attached} with a code.`
            : "Add table numbers on Tables. Attach the code here when it exists."}
      </p>
      <nav className="admin-tile-row" aria-label="Tables">
        <Link className="admin-tile" href="/admin/tables">
          <strong>Tables</strong>
          <span>Add a number first</span>
        </Link>
      </nav>

      {visibleTables.length === 0 ? (
        <p className="admin-empty">No tables yet. Add a number on Tables, then come back to attach the code.</p>
      ) : (
        <div className="admin-data-panel">
          <table className="admin-sheet">
            <thead>
              <tr>
                <th>On</th>
                <th>Restaurant</th>
                <th>Table</th>
                <th>Code</th>
                <th>Order</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibleTables.map((table) => {
                const st = codeStatus(table);
                const ord = tableOrderLabel(table);
                const busy = busyTableId === table.id;
                return (
                  <tr key={table.id}>
                    <td>
                      <button
                        type="button"
                        aria-label="On"
                        className={`admin-toggle${table.is_active ? " is-on" : ""}`}
                        onClick={() => toggleTableActive(table)}
                      />
                    </td>
                    <td className="admin-muted">{branchById.get(table.branch_id)?.name ?? "—"}</td>
                    <td className="admin-name">{table.number}</td>
                    <td>
                      <span className={st.cls}>{st.text}</span>
                    </td>
                    <td className="admin-muted">{ord.own ? `${ord.text} · this table` : ord.text}</td>
                    <td className="admin-row-acts">
                      <button type="button" className="admin-edit" disabled={busy} onClick={() => attachCode(table)}>
                        {busy ? "Working…" : table.qr_code_url ? "Regenerate" : "Attach"}
                      </button>
                      <button
                        type="button"
                        className="admin-edit"
                        disabled={!table.qr_code_url}
                        onClick={() => table.qr_code_url && navigator.clipboard?.writeText(table.qr_code_url)}
                      >
                        Copy link
                      </button>
                      <button
                        type="button"
                        className="admin-edit"
                        disabled={!table.qr_code_url}
                        onClick={() => table.qr_code_url && window.open(table.qr_code_url, "_blank")}
                      >
                        Print
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
