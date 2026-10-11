"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useMe, hasPermission } from "@/lib/use-me";
import { useCurrentBranch, type CurrentBranch } from "@/lib/use-current-branch";
import { AdminLoading } from "@/components/admin/admin-loading";

const LOGO_SRC = "/images/brand/logo.png";

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
function LivePhonePreview({
  branch,
  table,
  reloadToken,
  stage,
}: {
  branch: CurrentBranch;
  table: Table | null;
  reloadToken: number;
  // "gate" forces the mandatory sign-in overlay to show (?preview=signin,
  // the same param the guest page already reads); "menu" skips it
  // (?preview=admin) so staff can see the list underneath without
  // actually signing in.
  stage: "gate" | "menu";
}) {
  if (!table) {
    return (
      <div className="admin-handset-empty">
        Add an active table on Tables to preview the phone for {branch.name}.
      </div>
    );
  }

  const previewParam = stage === "gate" ? "signin" : "admin";
  const src = `/${branch.slug}/order?table=${table.qr_token}&preview=${previewParam}&_r=${reloadToken}`;

  return (
    <div className="admin-handset-viewport">
      <iframe key={src} src={src} title={`Live table phone — ${branch.name}`} className="admin-handset-frame" />
    </div>
  );
}

export default function BranchQrPage({
  params,
}: {
  params: Promise<{ branchSlug: string }>;
}) {
  const { branchSlug } = use(params);
  const router = useRouter();
  const { me, loading: meLoading } = useMe();
  const { branch, loading: branchLoading } = useCurrentBranch(branchSlug);
  const canManage = hasPermission(me, "manage_tables");

  const [tables, setTables] = useState<Table[]>([]);
  const [mains, setMains] = useState<MainCategory[]>([]);
  const [subs, setSubs] = useState<SubCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [busyTableId, setBusyTableId] = useState<string | null>(null);
  const [insights, setInsights] = useState<DishInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [phoneUrlDraft, setPhoneUrlDraft] = useState("");
  const [savingPhoneUrl, setSavingPhoneUrl] = useState(false);
  // Which active table's QR session the mini phone previews — null means
  // "the first active one for this branch".
  const [previewTableId, setPreviewTableId] = useState<string | null>(null);
  const [scanStage, setScanStage] = useState<"gate" | "menu">("gate");

  useEffect(() => {
    if (!branch) return;
    apiFetch(`/tables?branch_id=${branch.id}`).then(setTables).catch(() => setTables([]));
    Promise.all([
      apiFetch(`/staff/menu/main-categories?branch_id=${branch.id}&include_inactive=true`),
      apiFetch(`/staff/menu/sub-categories?branch_id=${branch.id}&include_inactive=true`),
      apiFetch(`/staff/menu/menu-items?branch_id=${branch.id}&include_inactive=true`),
    ])
      .then(([m, s, i]) => {
        setMains(m);
        setSubs(s);
        setItems(i);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [branch]);

  useEffect(() => {
    if (meLoading || !me) return;
    if (!canManage) router.replace(`/${branchSlug}/dashboard`);
  }, [meLoading, me, canManage, branchSlug, router]);

  useEffect(() => {
    if (!branch) return;
    apiFetch(`/promotions/dish-insights?branch_id=${branch.id}`)
      .then(setInsights)
      .catch(() => setInsights(null));
  }, [branch]);

  useEffect(() => {
    setPhoneUrlDraft(branch?.settings?.phone_menu_url ?? "");
  }, [branch]);

  async function saveBranchPhoneUrl() {
    if (!branch) return;
    setSavingPhoneUrl(true);
    setError(null);
    try {
      await apiFetch(`/branches/${branch.id}/phone-menu-url`, {
        method: "PATCH",
        body: JSON.stringify({ phone_menu_url: phoneUrlDraft.trim() }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      setSavingPhoneUrl(false);
    }
  }

  async function setOrderMode(mode: "waiter" | "app") {
    if (!branch) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/branches/${branch.id}/order-mode`, {
        method: "PATCH",
        body: JSON.stringify({ order_mode: mode }),
      });
      setReloadToken((t) => t + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change that.");
    } finally {
      setSaving(false);
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

  if (meLoading || !me || !canManage || branchLoading || !branch) {
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
  const activeTables = tables.filter((t) => t.is_active);
  const previewTable = activeTables.find((t) => t.id === previewTableId) ?? activeTables[0] ?? null;
  const guestUrl = previewTable ? `/${branch.slug}/order?table=${previewTable.qr_token}` : null;
  const orderMode = branch.settings?.order_mode === "app" ? "app" : "waiter";

  const visibleTables = [...tables].sort((a, b) => a.number - b.number);

  function tableOrderLabel(table: Table): { text: string; own: boolean } {
    const own = table.order_mode === "app" || table.order_mode === "waiter";
    const mode = own ? table.order_mode : orderMode;
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
        <p className="admin-who">{me?.email ?? "—"}</p>
      </div>

      <h1>QR Codes</h1>
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
        <div className="admin-qr-preview">
          <section className="admin-handset" aria-label="Table phone">
            <div className="admin-handset-bar">
              <img src={LOGO_SRC} alt="Sweet1NE" />
              <p>{`${branch.name} · Table ${previewTable ? previewTable.number : "—"}`}</p>
            </div>
            <LivePhonePreview branch={branch} table={previewTable} reloadToken={reloadToken} stage={scanStage} />
          </section>

          <p className="admin-handset-mode">
            {orderMode === "app"
              ? "Order on the phone · hold before Toast"
              : "Ask a waiter · floor takes the order"}
          </p>
          {activeTables.length > 0 && (
            <label className="admin-handset-table">
              Preview table
              <select
                aria-label="Preview table"
                value={previewTable?.id ?? ""}
                onChange={(e) => setPreviewTableId(e.target.value)}
              >
                {activeTables.map((t) => (
                  <option key={t.id} value={t.id}>
                    Table {t.number}
                    {t.qr_code_url ? "" : " · no code yet"}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="admin-cats admin-scan-row" role="group" aria-label="On the phone">
            <button
              type="button"
              className={scanStage === "gate" ? "is-on" : undefined}
              onClick={() => setScanStage("gate")}
            >
              Scan
            </button>
            <button
              type="button"
              className={scanStage === "menu" ? "is-on" : undefined}
              onClick={() => setScanStage("menu")}
            >
              Menu
            </button>
          </div>
          <button type="button" className="admin-edit" onClick={() => setReloadToken((t) => t + 1)}>
            Replay scan
          </button>
          {guestUrl && (
            <p className="admin-handset-open">
              <a href={guestUrl} target="_blank" rel="noopener">
                Open full guest page
              </a>
            </p>
          )}
        </div>

        <div>
          <h2 className="admin-board-h">How they order</h2>
          <p className="admin-dek">Gold is the live mode. The basket at the bottom of the phone changes with it.</p>
          <div>
            <div className="admin-order-row">
              <h2>{branch.name}</h2>
              <div className="admin-choice" role="group" aria-label={branch.name}>
                <button
                  type="button"
                  disabled={saving}
                  className={orderMode === "waiter" ? "is-on" : undefined}
                  onClick={() => setOrderMode("waiter")}
                >
                  <strong>Ask a waiter</strong>
                  <span>Floor takes the order</span>
                </button>
                <button
                  type="button"
                  disabled={saving}
                  className={orderMode === "app" ? "is-on" : undefined}
                  onClick={() => setOrderMode("app")}
                >
                  <strong>Order on the phone</strong>
                  <span>Hold before Toast</span>
                </button>
              </div>
            </div>
          </div>

          <div className="admin-qr-quiet">
            <p className="admin-kicker">Need a picture</p>
            <p className="admin-dek">
              {needPicture.length === 0 ? "Every dish on the menu has a picture." : ""}
            </p>
            <ul className="admin-need-list">
              {needPicture.slice(0, 6).map((item) => (
                <li key={item.id}>
                  <span>{item.title}</span>
                  <Link className="admin-edit" href={`/${branchSlug}/menu/manage`}>
                    Add
                  </Link>
                </li>
              ))}
              {needPicture.length > 6 && (
                <li>
                  <span />
                  <Link className="admin-edit" href={`/${branchSlug}/menu/manage`}>
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
                    <Link className="admin-edit" href={`/${branchSlug}/promotions`}>
                      Lift
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

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
                saveBranchPhoneUrl();
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
        </div>
      </div>

      <h2 className="admin-board-h">Table codes</h2>
      <p className="admin-dek">
        {loading ? "Loading…" : tables.length ? `${tables.length} tables · ${attached} with codes` : (
          <>
            Add table numbers on Tables. Attach the code here when it exists.{" "}
            <Link href={`/${branchSlug}/tables`}>Tables</Link>
          </>
        )}
      </p>

      {visibleTables.length === 0 ? (
        <p className="admin-empty">No tables yet. Add a number on Tables, then come back to attach the code.</p>
      ) : (
        <div className="admin-data-panel">
          <table className="admin-sheet">
            <thead>
              <tr>
                <th>On</th>
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
