"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { useMe, hasPermission } from "@/lib/use-me";
import { AdminLoading } from "@/components/admin/admin-loading";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DARK_DIALOG =
  "border border-[rgba(201,162,74,0.42)] bg-[#0c0c0c] text-[#e5e2e1] sm:max-w-sm";
const DIALOG_BOOK_BTN =
  "inline-block rounded-[3px] border border-[rgba(201,162,74,0.9)] bg-transparent px-[1.15rem] py-[0.7rem] text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-[#c9a24a] hover:bg-[#c9a24a] hover:text-[#0e0e0e]";
const DIALOG_GHOST_BTN =
  "inline-block rounded-[3px] border border-[rgba(229,226,225,0.25)] bg-transparent px-[1.15rem] py-[0.7rem] text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-[#e5e2e1] hover:bg-[rgba(229,226,225,0.08)]";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

type Subscriber = {
  id: string;
  email: string;
  source: string;
  is_subscribed: boolean;
  consented_at: string;
  unsubscribed_at: string | null;
  is_read: boolean;
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
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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
  const [importOpen, setImportOpen] = useState(false);
  const [importNote, setImportNote] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [drawerSlot, setDrawerSlot] = useState<Element | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  // Non-null opens the confirm dialog — set to either the whole checked
  // selection (the bulk "Delete selected" button) or a single row (that
  // row's own Remove button), so one dialog and one delete function cover
  // both.
  const [deleteTargets, setDeleteTargets] = useState<Subscriber[] | null>(null);

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
    // No per-row "open" here (a subscriber is just an email, not a
    // message) — viewing the list itself is what clears the sidebar's
    // "new leads" badge.
    apiFetch("/newsletter/subscribers/mark-read", { method: "POST" }).catch(() => {});
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
      setSubscribers((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update that.");
    }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllVisible(ids: string[]) {
    setSelected((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      }
      return new Set([...prev, ...ids]);
    });
  }

  async function confirmDelete() {
    if (!deleteTargets || deleteTargets.length === 0) return;
    setDeleting(true);
    setError(null);
    const ids = deleteTargets.map((r) => r.id);
    try {
      // One request per lead, not a bulk endpoint — there isn't one, and
      // the list here is small enough that this stays instant.
      await Promise.all(
        ids.map((id) =>
          apiFetch(`/newsletter/subscribers/${id}`, { method: "DELETE" }),
        ),
      );
      const idSet = new Set(ids);
      setSubscribers((prev) => prev.filter((r) => !idSet.has(r.id)));
      setSelected((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      setDeleteTargets(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't remove all of those — reload and check what's left.",
      );
      load();
    } finally {
      setDeleting(false);
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
        headers: session
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
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
      setError(
        err instanceof Error ? err.message : "Couldn't export the list.",
      );
    } finally {
      setExporting(false);
    }
  }

  if (meLoading || !me || !canManage) {
    return <AdminLoading />;
  }

  const customSources = Array.from(new Set(subscribers.map((r) => r.source))).filter(
    (src) => !SOURCE_FILTERS.includes(src),
  );
  const all = subscribers.length;
  const on = subscribers.filter((s) => s.is_subscribed).length;
  const qr = subscribers.filter((s) => s.source === "qr").length;
  const out = subscribers.filter((s) => !s.is_subscribed).length;

  const visible = subscribers.filter((row) => {
    if (sourceFilter !== "all" && row.source !== sourceFilter) return false;
    if (mailFilter === "on" && !row.is_subscribed) return false;
    if (mailFilter === "off" && row.is_subscribed) return false;
    if (
      query.trim() &&
      !row.email.toLowerCase().includes(query.trim().toLowerCase())
    )
      return false;
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
        <button
          type="button"
          className={sourceFilter === "all" ? "is-on" : undefined}
          onClick={() => setSourceFilter("all")}
        >
          All
        </button>
        {[...SOURCE_FILTERS, ...customSources].map((s) => (
          <button
            key={s}
            type="button"
            className={sourceFilter === s ? "is-on" : undefined}
            onClick={() => setSourceFilter(s)}
          >
            {sourceLabel(s)}
          </button>
        ))}
      </div>

      <div className="admin-cats" role="group" aria-label="Mail">
        <button
          type="button"
          className={mailFilter === "all" ? "is-on" : undefined}
          onClick={() => setMailFilter("all")}
        >
          All
        </button>
        <button
          type="button"
          className={mailFilter === "on" ? "is-on" : undefined}
          onClick={() => setMailFilter("on")}
        >
          Can be emailed
        </button>
        <button
          type="button"
          className={mailFilter === "off" ? "is-on" : undefined}
          onClick={() => setMailFilter("off")}
        >
          Opted out
        </button>
      </div>

      <div className="admin-tools">
        <input
          type="search"
          className="flex-1"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by email"
        />
        <button
          type="button"
          className="admin-book"
          onClick={() => {
            setImportOpen(false);
            setAddOpen(true);
          }}
        >
          Add lead
        </button>
        <button
          type="button"
          className="admin-book"
          onClick={() => {
            setAddOpen(false);
            setImportOpen(true);
          }}
        >
          Import
        </button>
        <button
          type="button"
          className="admin-book"
          onClick={exportCsv}
          disabled={exporting}
        >
          {exporting ? "Preparing…" : "Export CSV"}
        </button>
        {selected.size > 0 && (
          <button
            type="button"
            className="admin-book"
            onClick={() =>
              setDeleteTargets(subscribers.filter((s) => selected.has(s.id)))
            }
          >
            Delete selected ({selected.size})
          </button>
        )}
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
                <th>
                  <input
                    type="checkbox"
                    aria-label="Select all on this filter"
                    checked={
                      visible.length > 0 &&
                      visible.every((r) => selected.has(r.id))
                    }
                    onChange={() =>
                      toggleSelectAllVisible(visible.map((r) => r.id))
                    }
                  />
                </th>
                <th>Mail</th>
                <th>Email</th>
                <th>Came from</th>
                <th>Agreed</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Select ${row.email}`}
                      checked={selected.has(row.id)}
                      onChange={() => toggleSelected(row.id)}
                    />
                  </td>
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
                  <td className="admin-muted">
                    {formatDate(row.consented_at)}
                  </td>
                  <td className="admin-row-acts">
                    <button
                      type="button"
                      className="admin-edit"
                      onClick={() => setDeleteTargets([row])}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={deleteTargets !== null}
        onOpenChange={(open) => !open && setDeleteTargets(null)}
      >
        <DialogContent className={DARK_DIALOG}>
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-[#e5e2e1]">
              Remove {deleteTargets?.length ?? 0}{" "}
              {deleteTargets?.length === 1 ? "lead" : "leads"}?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#a8a4a2]">
            {deleteTargets?.length === 1 && deleteTargets[0].email}
            {deleteTargets?.length === 1 ? " is " : "They're "}
            deleted for good — not the same as opting them out. Campaigns can no
            longer reach them, and re-adding a removed email starts their
            consent record over.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className={DIALOG_GHOST_BTN}
              onClick={() => setDeleteTargets(null)}
            >
              Keep them
            </button>
            <button
              type="button"
              className={DIALOG_BOOK_BTN}
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? "Removing…" : "Delete"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add lead — portaled into the third grid column owned by the shared
          /admin layout, same as menu, events, tables, staff, roles, inbox
          and marketing. See #admin-drawer-slot in admin/layout.tsx. */}
      {importOpen &&
        drawerSlot &&
        createPortal(
          <ImportLeadsDrawer
            knownSources={[...SOURCE_FILTERS, ...customSources]}
            onClose={() => setImportOpen(false)}
            onImported={(note) => {
              setImportNote(note);
              load();
            }}
          />,
          drawerSlot,
        )}

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
          drawerSlot,
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
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
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
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
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

function ImportLeadsDrawer({
  knownSources,
  onClose,
  onImported,
}: {
  knownSources: string[];
  onClose: () => void;
  onImported: (note: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState("import");
  const [consent, setConsent] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string[] | null>(null);

  function downloadTemplate() {
    const blob = new Blob(["email,source,consent\nname@example.com,Wedding fair,yes\n"], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sweet1ne-leads-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setWorking(true);
    setError(null);
    setResult(null);
    try {
      const {
        data: { session },
      } = await createClient().auth.getSession();

      const body = new FormData();
      body.append("file", file);
      body.append("source", source.trim() || "import");
      body.append("consented", String(consent));

      const res = await fetch(`${API_URL}/newsletter/import`, {
        method: "POST",
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Couldn't import that file.");

      const lines = [
        `${data.added} added as "${data.source}"${data.added ? ` (${data.mailable} can be emailed)` : ""}`,
        data.already_there ? `${data.already_there} were already on the list and left as they were` : "",
        data.duplicates_in_file ? `${data.duplicates_in_file} repeated in the file` : "",
        data.unreadable ? `${data.unreadable} rows had no email` : "",
        data.other_company ? `${data.other_company} belong to another company's list` : "",
        data.truncated ? "Only the first 25,000 rows were read" : "",
      ].filter(Boolean);
      setResult(lines);
      onImported(lines.join(" · "));
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't import that file.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <aside className="admin-drawer-edit">
      <h2>Import leads</h2>
      <form onSubmit={handleSubmit} className="admin-form">
        <fieldset disabled={working} className="contents">
          {error && (
            <p role="alert" className="admin-hold mb-3 text-sm">
              {error}
            </p>
          )}

          <label>
            Excel or CSV file
            <input
              type="file"
              accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <p className="!mb-3 !mt-[-0.4rem] text-xs normal-case tracking-normal text-[var(--ivory-dim)]">
            Needs a column headed <strong>email</strong>. Optional columns: <strong>source</strong> and{" "}
            <strong>consent</strong> (yes/no). Up to 25,000 rows, every tab is read.{" "}
            <button type="button" className="underline" onClick={downloadTemplate}>
              Download a template
            </button>
          </p>

          <label>
            Where are these leads from?
            <input
              list="lead-sources"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="e.g. Wedding fair 2026"
              maxLength={60}
            />
            <datalist id="lead-sources">
              {knownSources.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
          <p className="!mb-3 !mt-[-0.4rem] text-xs normal-case tracking-normal text-[var(--ivory-dim)]">
            Every imported lead gets this label. A <strong>source</strong> column in the file overrides it for that row.
          </p>

          <label className="!mb-1 flex items-center gap-2 !normal-case !tracking-normal text-sm text-[var(--ivory)]">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            Everyone in this file asked to be emailed
          </label>
          <p className="!mb-3 !mt-[-0.4rem] text-xs normal-case tracking-normal text-[var(--ivory-dim)]">
            Tick only if you can show they agreed. Leave it empty and they are saved but never emailed. A{" "}
            <strong>consent</strong> column overrides this per row. People already on the list, including anyone
            who unsubscribed, are never changed.
          </p>

          {result && (
            <ul className="mb-3 space-y-1 text-sm text-[var(--ivory)]">
              {result.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}

          <div className="flex gap-3 pt-1">
            <button type="submit" className="admin-book" disabled={working || !file}>
              {working ? "Importing…" : "Import"}
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
