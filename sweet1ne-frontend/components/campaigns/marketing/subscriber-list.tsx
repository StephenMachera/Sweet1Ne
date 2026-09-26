"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Download, Mail, Search, Send, TrendingUp, UserMinus, Users } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type Stats = {
  total: number;
  subscribed: number;
  unsubscribed: number;
  from_website: number;
  from_reservations: number;
};

const SOURCE_LABELS: Record<string, string> = {
  qr: "Table QR",
  website: "The website",
  events: "Events",
  order: "Order",
  contact: "Contact",
  campaign: "Campaign",
  promo: "Promotion",
  reservation: "A booking",
  import: "Import",
};

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? "The website";
}

/**
 * The subscriber list, shared between admin and branch.
 *
 * Branch managers can see who's on the list but not send to it — the list is
 * company-wide, so two people sending independently is how a subscriber ends
 * up with two Valentine's emails in one morning.
 */
export function SubscriberList({
  tone,
  canSendCampaigns,
  hideHeader = false,
  onChanged,
}: {
  tone: "admin" | "branch";
  canSendCampaigns: boolean;
  /** Admin-only — the unified /admin/marketing page renders its own h1/dek
   *  and stats above a Campaigns/The list tab switcher, so this skips the
   *  duplicate of both. */
  hideHeader?: boolean;
  /** Admin-only — the page's own stats board needs to refresh after a
   *  toggle or a new add changes the real counts. */
  onChanged?: () => void;
}) {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [adminFilter, setAdminFilter] = useState<"active" | "out" | "all">("active");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [drawerSlot, setDrawerSlot] = useState<Element | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a real DOM node from a sibling tree, only available after commit
    setDrawerSlot(document.getElementById("admin-drawer-slot"));
  }, []);

  const isBranch = tone === "branch";

  const card = isBranch
    ? "border-slate-bg bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
    : "border-[var(--gold-line)] bg-[var(--panel-2)]";
  const text = isBranch ? "text-navy" : "text-[var(--ivory)]";
  const muted = isBranch ? "text-slate-muted" : "text-[var(--ivory-dim)]";
  const subtle = isBranch ? "text-slate-subtle" : "text-[var(--ivory-dim)]";
  const primary = isBranch
    ? "bg-gradient-to-br from-emerald to-emerald-dark text-white hover:opacity-90"
    : "bg-[var(--gold)] text-[#0e0e0e] hover:opacity-90";
  const activeBadge = isBranch ? "bg-success-bg text-success" : "admin-status is-ok";
  const inactiveBadge = isBranch ? "bg-slate-bg text-slate-subtle" : "admin-status";
  const headerRow = isBranch ? "bg-slate-bg/40" : "";

  const load = useCallback(() => {
    setLoading(true);
    // Admin always fetches everyone — its own Active/Opted out/All filter
    // is applied client-side. Branch keeps its original server-side toggle.
    const subscribedOnly = isBranch ? !showAll : false;
    Promise.all([
      apiFetch(`/newsletter/subscribers?subscribed_only=${subscribedOnly}`),
      apiFetch("/newsletter/stats"),
    ])
      .then(([list, s]) => {
        setSubscribers(list);
        setStats(s);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [showAll, isBranch]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleMail(row: Subscriber) {
    setError(null);
    try {
      const updated = await apiFetch(`/newsletter/subscribers/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_subscribed: !row.is_subscribed }),
      });
      setSubscribers((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      onChanged?.();
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

      // Blob rather than a plain link — the download needs the auth header,
      // which an <a download> can't carry.
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `sweet1ne-subscribers-${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't export the list.");
    } finally {
      setExporting(false);
    }
  }

  const visible = subscribers.filter((s) => {
    if (!isBranch) {
      if (adminFilter === "active" && !s.is_subscribed) return false;
      if (adminFilter === "out" && s.is_subscribed) return false;
    }
    return s.email.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <div className="space-y-6">
      {isBranch ? (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className={`text-2xl font-semibold sm:text-3xl ${text}`}>Marketing</h1>
            <p className={`mt-1 text-sm ${subtle}`}>
              Everyone who's agreed to hear from Sweet1NE
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {canSendCampaigns && (
              <Link
                href="/admin/marketing/campaigns"
                className="inline-flex h-10 items-center rounded-lg bg-gold px-4 text-sm font-medium text-ink transition-colors hover:bg-gold/90"
              >
                <Send size={16} className="mr-1.5" />
                Campaigns
              </Link>
            )}

            <Button
              variant={canSendCampaigns ? "ghost" : "default"}
              onClick={exportCsv}
              disabled={exporting || !stats?.subscribed}
              className={canSendCampaigns ? "" : primary}
            >
              <Download size={16} className="mr-1.5" />
              {exporting ? "Preparing…" : "Export CSV"}
            </Button>
          </div>
        </div>
      ) : (
        !hideHeader && (
          <>
            <h1>Marketing</h1>
            <p className="admin-dek">Everyone who&rsquo;s agreed to hear from Sweet1NE</p>
          </>
        )
      )}

      {error &&
        (isBranch ? (
          <div
            role="alert"
            className="rounded-xl border border-danger/25 bg-danger-bg px-4 py-3 text-sm text-danger"
          >
            {error}
          </div>
        ) : (
          <p className="admin-hold text-sm">{error}</p>
        ))}

      {/* The list is company-wide, so a branch manager should know that
          what they're looking at isn't only their own customers. */}
      {!canSendCampaigns && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            isBranch ? "bg-info-bg text-info" : "bg-teal-soft text-teal"
          }`}
        >
          This list covers both branches. Campaigns are sent centrally, so
          nobody gets the same email twice.
        </div>
      )}

      {stats &&
        (isBranch ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={<Users size={18} strokeWidth={1.5} />}
              label="On the list"
              value={stats.subscribed}
              tone={tone}
              accent="primary"
            />
            <StatCard
              icon={<TrendingUp size={18} strokeWidth={1.5} />}
              label="From the website"
              value={stats.from_website}
              tone={tone}
              accent="info"
            />
            <StatCard
              icon={<Mail size={18} strokeWidth={1.5} />}
              label="From bookings"
              value={stats.from_reservations}
              tone={tone}
              accent="success"
            />
            <StatCard
              icon={<UserMinus size={18} strokeWidth={1.5} />}
              label="Opted out"
              value={stats.unsubscribed}
              tone={tone}
              accent="muted"
            />
          </div>
        ) : !hideHeader ? (
          <div className="admin-kpi-strip" aria-label="Summary">
            <div>
              <span className="admin-kpi-n">{stats.subscribed}</span>
              <span className="admin-kpi-l">On the list</span>
            </div>
            <div>
              <span className="admin-kpi-n">{stats.from_website}</span>
              <span className="admin-kpi-l">Website</span>
            </div>
            <div>
              <span className="admin-kpi-n">{stats.from_reservations}</span>
              <span className="admin-kpi-l">Bookings</span>
            </div>
            <div>
              <span className="admin-kpi-n">{stats.unsubscribed}</span>
              <span className="admin-kpi-l">Opted out</span>
            </div>
          </div>
        ) : null)}

      {isBranch ? (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search
              size={16}
              className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${muted}`}
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by email"
              className="border-slate-border pl-9"
            />
          </div>

          <button
            onClick={() => setShowAll((v) => !v)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              showAll
                ? "bg-navy text-white"
                : "border border-slate-border bg-white text-slate-subtle hover:text-navy"
            }`}
          >
            {showAll ? "Showing everyone" : "Active only"}
          </button>
        </div>
      ) : (
        <div className="admin-cats" role="group" aria-label="Status">
          <button
            type="button"
            className={adminFilter === "active" ? "is-on" : undefined}
            onClick={() => setAdminFilter("active")}
          >
            Active
          </button>
          <button
            type="button"
            className={adminFilter === "out" ? "is-on" : undefined}
            onClick={() => setAdminFilter("out")}
          >
            Opted out
          </button>
          <button
            type="button"
            className={adminFilter === "all" ? "is-on" : undefined}
            onClick={() => setAdminFilter("all")}
          >
            All
          </button>
        </div>
      )}
      {!isBranch && (
        <div className="admin-tools">
          <input
            type="search"
            className="flex-1"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by email"
          />
          <button type="button" className="admin-book" onClick={() => setAddOpen(true)}>
            Add
          </button>
          <button type="button" className="admin-book" onClick={exportCsv} disabled={exporting || !stats?.subscribed}>
            {exporting ? "Preparing…" : "Export CSV"}
          </button>
        </div>
      )}

      {loading ? (
        isBranch ? (
          <p className={`text-sm ${muted}`}>Loading…</p>
        ) : (
          <AdminLoading />
        )
      ) : visible.length === 0 ? (
        isBranch ? (
          <div className="rounded-xl border border-dashed border-slate-border px-6 py-16 text-center">
            <Mail size={26} strokeWidth={1} className={`mx-auto ${muted}`} />
            <p className={`mt-3 text-sm ${muted}`}>
              {query ? "Nobody matches that search." : "Nobody's subscribed yet."}
            </p>
          </div>
        ) : (
          <p className="admin-empty">No one on this filter.</p>
        )
      ) : isBranch ? (
        <div className={`overflow-x-auto rounded-xl border ${card}`}>
          <table className="w-full min-w-[560px] text-sm">
            <thead className={`border-b border-slate-bg ${headerRow}`}>
              <tr className={`text-left text-[11px] uppercase tracking-[0.14em] ${muted}`}>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Came from</th>
                <th className="px-5 py-3 font-medium">Agreed</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-bg">
              {visible.map((subscriber) => (
                <tr key={subscriber.id}>
                  <td className="px-5 py-3.5">
                    <a href={`mailto:${subscriber.email}`} className={text}>
                      {subscriber.email}
                    </a>
                  </td>
                  <td className={`px-5 py-3.5 ${muted}`}>
                    {subscriber.source === "reservation" ? "A booking" : "The website"}
                  </td>
                  <td className={`px-5 py-3.5 ${muted}`}>
                    {new Date(subscriber.consented_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        subscriber.is_subscribed ? activeBadge : inactiveBadge
                      }`}
                    >
                      {subscriber.is_subscribed ? "Active" : "Opted out"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="admin-data-panel">
          <table className="admin-sheet">
            <thead>
              <tr>
                <th>On</th>
                <th>Email</th>
                <th>Came from</th>
                <th>Agreed</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((subscriber) => (
                <tr key={subscriber.id}>
                  <td>
                    <button
                      type="button"
                      aria-label="On"
                      className={`admin-toggle${subscriber.is_subscribed ? " is-on" : ""}`}
                      onClick={() => toggleMail(subscriber)}
                    />
                  </td>
                  <td>
                    <a href={`mailto:${subscriber.email}`} className="admin-name">
                      {subscriber.email}
                    </a>
                  </td>
                  <td className="admin-muted">{sourceLabel(subscriber.source)}</td>
                  <td className="admin-muted">
                    {new Date(subscriber.consented_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td>
                    <span className={subscriber.is_subscribed ? activeBadge : inactiveBadge}>
                      {subscriber.is_subscribed ? "Active" : "Opted out"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className={`text-xs leading-relaxed ${muted}`}>
        Everyone here ticked a box asking to be emailed, and the date they did
        is stored with their address — that record is what proves consent was
        given if anyone ever asks. Exporting includes it.
      </p>

      {/* Admin-only — portaled into the third grid column owned by the
          shared /admin layout, same pattern as menu, events, tables and
          leads. See #admin-drawer-slot in admin/layout.tsx. */}
      {!isBranch &&
        addOpen &&
        drawerSlot &&
        createPortal(
          <AddSubscriberDrawer
            onClose={() => setAddOpen(false)}
            onAdded={(row) => {
              setSubscribers((prev) => {
                const existing = prev.findIndex((r) => r.id === row.id);
                if (existing === -1) return [row, ...prev];
                return prev.map((r) => (r.id === row.id ? row : r));
              });
              setAddOpen(false);
              onChanged?.();
            }}
          />,
          drawerSlot
        )}
    </div>
  );
}

function AddSubscriberDrawer({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: (row: Subscriber) => void;
}) {
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("website");
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) {
      setError("Only add someone who ticked a box asking to be emailed.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await apiFetch("/newsletter/subscribers", {
        method: "POST",
        body: JSON.stringify({ email, source, consented: true }),
      });
      onAdded(result.subscriber);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add that.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside className="admin-drawer-edit">
      <h2>Add to the list</h2>
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
              <option value="website">The website</option>
              <option value="events">Events</option>
              <option value="order">Order</option>
              <option value="qr">Table QR</option>
              <option value="reservation">A booking</option>
              <option value="import">Import</option>
            </select>
          </label>

          <label className="!mb-1 flex items-center gap-2 !normal-case !tracking-normal text-sm text-[var(--ivory)]">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            Consent
          </label>
          <p className="!mb-3 !mt-[-0.4rem] text-xs normal-case tracking-normal text-[var(--ivory-dim)]">
            Only if they ticked a box asking to be emailed.
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

function StatCard({
  icon,
  label,
  value,
  tone,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "admin" | "branch";
  accent: "primary" | "info" | "success" | "muted";
}) {
  const isBranch = tone === "branch";

  const accents = isBranch
    ? {
        primary: "bg-success-bg text-success",
        info: "bg-info-bg text-info",
        success: "bg-purple-bg text-purple",
        muted: "bg-slate-bg text-slate-subtle",
      }
    : {
        primary: "bg-gold-soft text-[#8a6a28]",
        info: "bg-teal-soft text-teal",
        success: "bg-sage-soft text-sage",
        muted: "bg-ink/5 text-ink-muted",
      };

  return (
    <div
      className={`rounded-xl border p-5 ${
        isBranch
          ? "border-slate-bg bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
          : "border-ink/8 bg-white shadow-[0_1px_3px_rgba(20,24,28,0.04)]"
      }`}
    >
      <span
        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${accents[accent]}`}
      >
        {icon}
      </span>
      <p className={`mt-4 text-3xl font-semibold ${isBranch ? "text-navy" : "text-ink"}`}>
        {value}
      </p>
      <p className={`mt-1 text-sm ${isBranch ? "text-slate-subtle" : "text-ink-muted"}`}>
        {label}
      </p>
    </div>
  );
}