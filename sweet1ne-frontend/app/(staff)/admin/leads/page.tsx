"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { useMe, hasPermission } from "@/lib/use-me";
import { AdminLoading } from "@/components/admin/admin-loading";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

type Subscriber = {
  id: string;
  email: string;
  source: string;
  is_subscribed: boolean;
  consented_at: string;
  unsubscribed_at: string | null;
};

const SOURCE_LABELS: Record<string, string> = {
  qr: "Table QR",
  website: "Website",
  events: "Events",
  order: "Order",
  contact: "Contact",
  campaign: "Campaign",
  promo: "Promotion",
  reservation: "A booking",
  import: "Import",
};

const SOURCE_FILTERS = [
  "qr",
  "website",
  "events",
  "order",
  "contact",
  "campaign",
  "promo",
  "reservation",
  "import",
];

function sourceLabel(source: string) {
  return SOURCE_LABELS[source] ?? source;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function parseCsvRows(text: string): { email: string; source: string; consented: boolean }[] {
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim());
  if (lines.length === 0) return [];

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const emailIdx = header.indexOf("email");
  const sourceIdx = header.indexOf("source");
  const consentIdx = header.findIndex((h) => h.includes("consent"));
  const hasHeader = emailIdx !== -1;
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const col = hasHeader ? emailIdx : 0;

  return dataLines
    .map((line) => line.split(","))
    .filter((cols) => (cols[col] ?? "").includes("@"))
    .map((cols) => ({
      email: cols[col].trim(),
      source: sourceIdx !== -1 ? cols[sourceIdx]?.trim() || "import" : "import",
      consented: consentIdx !== -1 ? /^(y|yes|true|1)$/i.test(cols[consentIdx]?.trim() || "") : false,
    }));
}

export default function AdminLeadsPage() {
  const router = useRouter();
  const { me, loading: meLoading } = useMe();
  const canManage = hasPermission(me, "manage_marketing");

  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState("all");
  const [mailFilter, setMailFilter] = useState<"all" | "on" | "off">("all");
  const [query, setQuery] = useState("");
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importNote, setImportNote] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [drawerSlot, setDrawerSlot] = useState<Element | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    apiFetch("/newsletter/subscribers?subscribed_only=false")
      .then(setSubscribers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (meLoading || !me) return;
    if (!canManage) {
      router.replace("/admin/dashboard");
      return;
    }
    load();
  }, [meLoading, me, canManage, router, load]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a real DOM node from a sibling tree, only available after commit
    setDrawerSlot(document.getElementById("admin-drawer-slot"));
  }, []);

  async function toggleMail(row: Subscriber) {
    setError(null);
    try {
      const updated = await apiFetch(`/newsletter/subscribers/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_subscribed: !row.is_subscribed }),
      });
      setSubscribers((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update that.");
    }
  }

  async function exportCsv() {
    setExporting(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await createClient().auth.getSession();

      const res = await fetch(`${API_URL}/newsletter/export`, {
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (!res.ok) throw new Error("Export failed.");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `sweet1ne-leads-${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't export the list.");
    } finally {
      setExporting(false);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImporting(true);
    setError(null);
    let added = 0;
    let updated = 0;
    let skipped = 0;
    try {
      const rows = parseCsvRows(await file.text());
      for (const row of rows) {
        try {
          const result = await apiFetch("/newsletter/subscribers", {
            method: "POST",
            body: JSON.stringify(row),
          });
          if (result.created) added++;
          else updated++;
        } catch {
          skipped++;
        }
      }
      setImportNote(
        `${added} added · ${updated} already there · ${skipped} skipped. Consent yes is the send list.`
      );
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that file.");
    } finally {
      setImporting(false);
    }
  }

  if (meLoading || !me || !canManage) {
    return <AdminLoading />;
  }

  const all = subscribers.length;
  const on = subscribers.filter((s) => s.is_subscribed).length;
  const qr = subscribers.filter((s) => s.source === "qr").length;
  const out = subscribers.filter((s) => !s.is_subscribed).length;

  const visible = subscribers.filter((row) => {
    if (sourceFilter !== "all" && row.source !== sourceFilter) return false;
    if (mailFilter === "on" && !row.is_subscribed) return false;
    if (mailFilter === "off" && row.is_subscribed) return false;
    if (query.trim() && !row.email.toLowerCase().includes(query.trim().toLowerCase())) return false;
    return true;
  });

  return (
    <>
      <div className="admin-top">
        <p className="admin-who">{me?.email ?? "—"}</p>
      </div>

      <h1>Leads</h1>
      <p className="admin-dek">
        {on} can be emailed · {all} leads
      </p>

      {error && <p className="admin-hold mb-3 text-sm">{error}</p>}

      <div className="admin-kpi-strip" aria-label="Leads">
        <div>
          <span className="admin-kpi-n">{all}</span>
          <span className="admin-kpi-l">Leads</span>
        </div>
        <div>
          <span className="admin-kpi-n">{on}</span>
          <span className="admin-kpi-l">Can be emailed</span>
        </div>
        <div>
          <span className="admin-kpi-n">{qr}</span>
          <span className="admin-kpi-l">Table QR</span>
        </div>
        <div>
          <span className="admin-kpi-n">{out}</span>
          <span className="admin-kpi-l">Opted out</span>
        </div>
      </div>

      <div className="admin-cats" role="group" aria-label="Came from">
        <button type="button" className={sourceFilter === "all" ? "is-on" : undefined} onClick={() => setSourceFilter("all")}>
          All
        </button>
        {SOURCE_FILTERS.map((s) => (
          <button key={s} type="button" className={sourceFilter === s ? "is-on" : undefined} onClick={() => setSourceFilter(s)}>
            {sourceLabel(s)}
          </button>
        ))}
      </div>

      <div className="admin-cats" role="group" aria-label="Mail">
        <button type="button" className={mailFilter === "all" ? "is-on" : undefined} onClick={() => setMailFilter("all")}>
          All
        </button>
        <button type="button" className={mailFilter === "on" ? "is-on" : undefined} onClick={() => setMailFilter("on")}>
          Can be emailed
        </button>
        <button type="button" className={mailFilter === "off" ? "is-on" : undefined} onClick={() => setMailFilter("off")}>
          Opted out
        </button>
      </div>

      <div className="admin-tools">
        <input type="search" className="flex-1" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by email" />
        <button type="button" className="admin-book" onClick={() => setAddOpen(true)}>
          Add lead
        </button>
        <button type="button" className="admin-book" onClick={() => fileInputRef.current?.click()} disabled={importing}>
          {importing ? "Importing…" : "Import CSV"}
        </button>
        <input ref={fileInputRef} type="file" accept=".csv,text/csv" hidden onChange={handleImport} />
        <button type="button" className="admin-book" onClick={exportCsv} disabled={exporting}>
          {exporting ? "Preparing…" : "Export CSV"}
        </button>
      </div>
      {importNote && <p className="admin-dek">{importNote}</p>}

      {loading ? (
        <AdminLoading />
      ) : visible.length === 0 ? (
        <p className="admin-empty">No leads on this filter.</p>
      ) : (
        <div className="admin-data-panel">
          <table className="admin-sheet">
            <thead>
              <tr>
                <th>Mail</th>
                <th>Email</th>
                <th>Came from</th>
                <th>Agreed</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id}>
                  <td>
                    <button
                      type="button"
                      aria-label="Mail"
                      className={`admin-toggle${row.is_subscribed ? " is-on" : ""}`}
                      onClick={() => toggleMail(row)}
                    />
                  </td>
                  <td>
                    <span className="admin-name">{row.email}</span>
                  </td>
                  <td className="admin-muted">{sourceLabel(row.source)}</td>
                  <td className="admin-muted">{formatDate(row.consented_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add lead — portaled into the third grid column owned by the shared
          /admin layout, same as menu, events, tables, staff, roles, inbox
          and marketing. See #admin-drawer-slot in admin/layout.tsx. */}
      {addOpen &&
        drawerSlot &&
        createPortal(
          <AddLeadDrawer
            onClose={() => setAddOpen(false)}
            onAdded={(row) => {
              setSubscribers((prev) => {
                const existing = prev.findIndex((r) => r.id === row.id);
                if (existing === -1) return [row, ...prev];
                return prev.map((r) => (r.id === row.id ? row : r));
              });
              setAddOpen(false);
            }}
          />,
          drawerSlot
        )}
    </>
  );
}

function AddLeadDrawer({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: (row: Subscriber) => void;
}) {
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("import");
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const result = await apiFetch("/newsletter/subscribers", {
        method: "POST",
        body: JSON.stringify({ email, source, consented: consent }),
      });
      onAdded(result.subscriber);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add that lead.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside className="admin-drawer-edit">
      <h2>Add lead</h2>
      <form onSubmit={handleSubmit} className="admin-form">
        <fieldset disabled={saving} className="contents">
          {error && (
            <p role="alert" className="admin-hold mb-3 text-sm">
              {error}
            </p>
          )}

          <label>
            Email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>

          <label>
            Came from
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="import">Import</option>
              <option value="qr">Table QR</option>
              <option value="website">Website</option>
              <option value="events">Events</option>
              <option value="order">Order</option>
              <option value="contact">Contact</option>
              <option value="campaign">Campaign</option>
              <option value="promo">Promotion</option>
              <option value="reservation">A booking</option>
            </select>
          </label>

          <label className="!mb-1 flex items-center gap-2 !normal-case !tracking-normal text-sm text-[var(--ivory)]">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            They asked to be emailed
          </label>
          <p className="!mb-3 !mt-[-0.4rem] text-xs normal-case tracking-normal text-[var(--ivory-dim)]">
            Tick only if they agreed. Campaigns skip anyone without this.
          </p>

          <div className="flex gap-3 pt-1">
            <button type="submit" className="admin-book" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" className="admin-book" onClick={onClose}>
              Close
            </button>
          </div>
        </fieldset>
      </form>
    </aside>
  );
}
