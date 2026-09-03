"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Download, Mail, Search, Send, TrendingUp, UserMinus, Users } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
}: {
  tone: "admin" | "branch";
  canSendCampaigns: boolean;
}) {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBranch = tone === "branch";

  const card = isBranch
    ? "border-slate-bg bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
    : "border-ink/8 bg-white shadow-[0_1px_3px_rgba(20,24,28,0.04)]";
  const text = isBranch ? "text-navy" : "text-ink";
  const muted = isBranch ? "text-slate-muted" : "text-ink-muted";
  const subtle = isBranch ? "text-slate-subtle" : "text-ink-muted";
  const primary = isBranch
    ? "bg-gradient-to-br from-emerald to-emerald-dark text-white hover:opacity-90"
    : "bg-gold text-ink hover:bg-gold/90";
  const activeBadge = isBranch ? "bg-success-bg text-success" : "bg-sage-soft text-sage";
  const inactiveBadge = isBranch ? "bg-slate-bg text-slate-subtle" : "bg-ink/5 text-ink-muted";
  const headerRow = isBranch ? "bg-slate-bg/40" : "bg-[#FBFCFD]";

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiFetch(`/newsletter/subscribers?subscribed_only=${!showAll}`),
      apiFetch("/newsletter/stats"),
    ])
      .then(([list, s]) => {
        setSubscribers(list);
        setStats(s);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [showAll]);

  useEffect(() => {
    load();
  }, [load]);

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

  const visible = subscribers.filter((s) =>
    s.email.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-6">
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

      {error && (
        <div
          role="alert"
          className={`rounded-xl px-4 py-3 text-sm ${
            isBranch
              ? "border border-danger/25 bg-danger-bg text-danger"
              : "border border-ember/25 bg-ember-soft text-ember"
          }`}
        >
          {error}
        </div>
      )}

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

      {stats && (
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
      )}

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
            className={`pl-9 ${isBranch ? "border-slate-border" : ""}`}
          />
        </div>

        <button
          onClick={() => setShowAll((v) => !v)}
          className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
            showAll
              ? isBranch
                ? "bg-navy text-white"
                : "bg-ink text-paper"
              : isBranch
                ? "border border-slate-border bg-white text-slate-subtle hover:text-navy"
                : "border border-ink/12 bg-white text-ink-muted hover:text-ink"
          }`}
        >
          {showAll ? "Showing everyone" : "Active only"}
        </button>
      </div>

      {loading ? (
        <p className={`text-sm ${muted}`}>Loading…</p>
      ) : visible.length === 0 ? (
        <div
          className={`rounded-xl border border-dashed px-6 py-16 text-center ${
            isBranch ? "border-slate-border" : "border-ink/15"
          }`}
        >
          <Mail size={26} strokeWidth={1} className={`mx-auto ${muted}`} />
          <p className={`mt-3 text-sm ${muted}`}>
            {query ? "Nobody matches that search." : "Nobody's subscribed yet."}
          </p>
        </div>
      ) : (
        <div className={`overflow-x-auto rounded-xl border ${card}`}>
          <table className="w-full min-w-[560px] text-sm">
            <thead className={`border-b ${isBranch ? "border-slate-bg" : "border-ink/8"} ${headerRow}`}>
              <tr className={`text-left text-[11px] uppercase tracking-[0.14em] ${muted}`}>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Came from</th>
                <th className="px-5 py-3 font-medium">Agreed</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isBranch ? "divide-slate-bg" : "divide-ink/5"}`}>
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
      )}

      <p className={`text-xs leading-relaxed ${muted}`}>
        Everyone here ticked a box asking to be emailed, and the date they did
        is stored with their address — that record is what proves consent was
        given if anyone ever asks. Exporting includes it.
      </p>
    </div>
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