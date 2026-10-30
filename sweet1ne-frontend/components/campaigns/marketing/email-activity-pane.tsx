"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChevronLeft } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { AdminLoading } from "@/components/admin/admin-loading";

type Summary = {
  attempted: number;
  sent: number;
  failed: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  total_opens: number;
  total_clicks: number;
  delivery_rate: number | null;
  open_rate: number | null;
  click_rate: number | null;
  bounce_rate: number | null;
};

type Overview = Summary & { days: number; campaigns: number };

type CampaignRow = Summary & {
  campaign_id: string;
  name: string;
  subject: string;
  audience: string;
  sent_at: string | null;
};

type FunnelStep = { step: string; count: number };
type TopLink = { link: string; clicks: number; people: number };
type TimelinePoint = { day: string; opens: number; clicks: number };

type CampaignDetail = Summary & {
  campaign_id: string;
  name: string;
  subject: string;
  audience: string;
  status: string;
  sent_at: string | null;
  funnel: FunnelStep[];
  top_links: TopLink[];
  timeline: TimelinePoint[];
};

type Recipient = {
  email: string;
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  first_opened_at: string | null;
  first_clicked_at: string | null;
  bounced_at: string | null;
  complained_at: string | null;
  open_count: number;
  click_count: number;
};

const DAY_RANGES = [
  { key: 7, label: "7 days" },
  { key: 30, label: "30 days" },
  { key: 90, label: "90 days" },
];

// Colors below were run through the dataviz skill's palette validator
// against this admin's own dark chart surface (#0c0c0c) — the brand gold
// at full brightness (--gold, #c9a24a) reads too light to pass the
// dark-mode categorical lightness band, so the actual data marks use a
// darker ordinal step of the same hue instead; literal brand gold stays
// for chrome (borders, headings) only, never as a chart fill.
// Funnel stages, light → dark, one hue (validated --ordinal, all pass).
const GOLD_ORDINAL = ["#f0dca8", "#dcb66b", "#c9a24a", "#8a6a2e"];
// Opens vs clicks — validated categorical pair (CVD ΔE 25.9, normal ΔE 26.7).
const SERIES_OPENS = "#a37d2e";
const SERIES_CLICKS = "#3987e5";

const CHART_INK = "#e5e2e1";
const CHART_MUTED = "rgba(229, 226, 225, 0.58)";
const CHART_GRID = "rgba(229, 226, 225, 0.08)";

const TOOLTIP_STYLE = {
  background: "#0c0c0c",
  border: "1px solid rgba(201, 162, 74, 0.35)",
  borderRadius: 6,
  fontSize: 12,
  color: CHART_INK,
};

const RECIPIENT_FILTERS = [
  { key: "", label: "Everyone" },
  { key: "delivered", label: "Delivered" },
  { key: "opened", label: "Opened" },
  { key: "clicked", label: "Clicked" },
  { key: "bounced", label: "Bounced" },
  { key: "failed", label: "Failed" },
];

function pct(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** The overview and every campaign row share this shape — one place to
 * render Sent/Delivered/Opened/Clicked with their rates as muted asides. */
function RateCell({
  count,
  rate,
  of,
}: {
  count: number;
  rate: number | null;
  of: string;
}) {
  return (
    <td>
      {count}{" "}
      <span className="admin-muted text-xs">
        ({pct(rate)} of {of})
      </span>
    </td>
  );
}

export function EmailActivityPane() {
  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(() => {
    // Refetching (a day-range change) keeps whatever's already on screen
    // rather than flashing back to a loading state — only the very first
    // load shows AdminLoading, via loading's own initial value.
    Promise.all([
      apiFetch(`/email-analytics/overview?days=${days}`),
      apiFetch(`/email-analytics/campaigns?days=${days}&page_size=50`),
    ])
      .then(([ov, camps]: [Overview, { items: CampaignRow[] }]) => {
        setOverview(ov);
        setCampaigns(camps.items);
        setError(null);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Couldn't load that."),
      )
      .finally(() => setLoading(false));
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  if (selectedId) {
    return (
      <CampaignDetailView
        key={selectedId}
        campaignId={selectedId}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  const funnel: FunnelStep[] = overview
    ? [
        { step: "Sent", count: overview.sent },
        { step: "Delivered", count: overview.delivered },
        { step: "Opened", count: overview.opened },
        { step: "Clicked", count: overview.clicked },
      ]
    : [];

  return (
    <>
      {error && <p className="admin-hold mb-3 text-sm">{error}</p>}

      <div className="admin-cats" role="group" aria-label="Date range">
        {DAY_RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            className={days === r.key ? "is-on" : undefined}
            onClick={() => setDays(r.key)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {loading ? (
        <AdminLoading />
      ) : !overview || overview.campaigns === 0 ? (
        <p className="admin-empty">No campaigns sent in this window yet.</p>
      ) : (
        <>
          <section
            className="admin-board admin-board-stats"
            aria-label="Email activity overview"
          >
            <article className="admin-card">
              <h2>Sent</h2>
              <p className="admin-stat">{overview.sent}</p>
              <p>
                {overview.campaigns} campaign
                {overview.campaigns === 1 ? "" : "s"}
              </p>
            </article>
            <article className="admin-card">
              <h2>Delivered</h2>
              <p className="admin-stat">{overview.delivered}</p>
              <p>{pct(overview.delivery_rate)} of sent</p>
            </article>
            <article className="admin-card">
              <h2>Opened</h2>
              <p className="admin-stat">{overview.opened}</p>
              <p>{pct(overview.open_rate)} of delivered</p>
            </article>
            <article className="admin-card">
              <h2>Clicked</h2>
              <p className="admin-stat">{overview.clicked}</p>
              <p>{pct(overview.click_rate)} of delivered</p>
            </article>
            <article
              className={overview.bounced > 0 ? "admin-card is-wait" : "admin-card"}
            >
              <h2>Bounced</h2>
              <p className="admin-stat">{overview.bounced}</p>
              <p>{pct(overview.bounce_rate)} of sent</p>
            </article>
            <article
              className={
                overview.complained > 0 ? "admin-card is-wait" : "admin-card"
              }
            >
              <h2>Complained</h2>
              <p className="admin-stat">{overview.complained}</p>
              <p>Marked as spam</p>
            </article>
          </section>

          <div className="admin-chart-card">
            <p className="admin-kicker">The funnel</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={funnel}
                layout="vertical"
                margin={{ top: 4, right: 36, bottom: 4, left: 4 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="step"
                  tick={{ fill: CHART_MUTED, fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={80}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  cursor={{ fill: "rgba(229,226,225,0.04)" }}
                />
                <Bar
                  dataKey="count"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={22}
                  label={{ position: "right", fill: CHART_INK, fontSize: 12 }}
                >
                  {funnel.map((_, i) => (
                    <Cell key={i} fill={GOLD_ORDINAL[i] ?? GOLD_ORDINAL.at(-1)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="admin-data-panel">
            <table className="admin-sheet">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Audience</th>
                  <th>Sent</th>
                  <th>Delivered</th>
                  <th>Opened</th>
                  <th>Clicked</th>
                  <th>Bounced</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr
                    key={c.campaign_id}
                    onClick={() => setSelectedId(c.campaign_id)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      <span className="admin-name">{c.subject || c.name}</span>
                      <br />
                      <span className="admin-muted text-xs">
                        {fmtDate(c.sent_at)}
                      </span>
                    </td>
                    <td className="admin-muted">{c.audience}</td>
                    <td>{c.sent}</td>
                    <RateCell count={c.delivered} rate={c.delivery_rate} of="sent" />
                    <RateCell count={c.opened} rate={c.open_rate} of="delivered" />
                    <RateCell count={c.clicked} rate={c.click_rate} of="delivered" />
                    <td className={c.bounced > 0 ? "admin-hold" : "admin-muted"}>
                      {c.bounced}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function CampaignDetailView({
  campaignId,
  onBack,
}: {
  campaignId: string;
  onBack: () => void;
}) {
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [recipientsTotal, setRecipientsTotal] = useState(0);
  const [recipientStatus, setRecipientStatus] = useState("");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [recipientPage, setRecipientPage] = useState(1);
  const RECIPIENT_PAGE_SIZE = 25;

  useEffect(() => {
    // The parent gives this view a key={campaignId}, so a different
    // campaign is a fresh mount — loading starts true via its own
    // initial state, nothing to reset here.
    apiFetch(`/email-analytics/campaigns/${campaignId}`)
      .then((d) => {
        setDetail(d);
        setError(null);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Couldn't load that campaign."),
      )
      .finally(() => setLoading(false));
  }, [campaignId]);

  useEffect(() => {
    const params = new URLSearchParams({
      page: String(recipientPage),
      page_size: String(RECIPIENT_PAGE_SIZE),
    });
    if (recipientStatus) params.set("status", recipientStatus);
    if (recipientSearch.trim()) params.set("search", recipientSearch.trim());

    apiFetch(`/email-analytics/campaigns/${campaignId}/recipients?${params}`)
      .then((r: { items: Recipient[]; total: number }) => {
        setRecipients(r.items);
        setRecipientsTotal(r.total);
      })
      .catch(() => {
        setRecipients([]);
        setRecipientsTotal(0);
      });
  }, [campaignId, recipientStatus, recipientSearch, recipientPage]);

  if (loading) return <AdminLoading />;

  return (
    <>
      <button
        type="button"
        className="admin-edit mb-3 inline-flex items-center gap-1"
        onClick={onBack}
      >
        <ChevronLeft size={14} />
        Back to email activity
      </button>

      {error && <p className="admin-hold mb-3 text-sm">{error}</p>}

      {detail && (
        <>
          <h2 className="font-display text-xl text-[var(--ivory)]">
            {detail.subject || detail.name}
          </h2>
          <p className="admin-dek">
            {fmtDate(detail.sent_at)} · {detail.audience} ·{" "}
            <span className={detail.status === "sent" ? "admin-status is-ok" : "admin-status"}>
              {detail.status}
            </span>
          </p>

          <section
            className="admin-board admin-board-stats"
            aria-label="Campaign summary"
          >
            <article className="admin-card">
              <h2>Sent</h2>
              <p className="admin-stat">{detail.sent}</p>
              <p>{detail.failed} failed</p>
            </article>
            <article className="admin-card">
              <h2>Delivered</h2>
              <p className="admin-stat">{detail.delivered}</p>
              <p>{pct(detail.delivery_rate)} of sent</p>
            </article>
            <article className="admin-card">
              <h2>Opened</h2>
              <p className="admin-stat">{detail.opened}</p>
              <p>{detail.total_opens} total opens</p>
            </article>
            <article className="admin-card">
              <h2>Clicked</h2>
              <p className="admin-stat">{detail.clicked}</p>
              <p>{detail.total_clicks} total clicks</p>
            </article>
          </section>

          <div className="admin-chart-card">
            <p className="admin-kicker">The funnel</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={detail.funnel}
                layout="vertical"
                margin={{ top: 4, right: 36, bottom: 4, left: 4 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="step"
                  tick={{ fill: CHART_MUTED, fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={80}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  cursor={{ fill: "rgba(229,226,225,0.04)" }}
                />
                <Bar
                  dataKey="count"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={22}
                  label={{ position: "right", fill: CHART_INK, fontSize: 12 }}
                >
                  {detail.funnel.map((_, i) => (
                    <Cell key={i} fill={GOLD_ORDINAL[i] ?? GOLD_ORDINAL.at(-1)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {detail.timeline.length > 0 && (
            <div className="admin-chart-card">
              <p className="admin-kicker">Opens &amp; clicks over time</p>
              <div className="admin-chart-legend" aria-hidden="true">
                <span>
                  <i style={{ background: SERIES_OPENS }} />
                  Opens
                </span>
                <span>
                  <i style={{ background: SERIES_CLICKS }} />
                  Clicks
                </span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={detail.timeline.map((t) => ({ ...t, label: fmtDay(t.day) }))}
                  margin={{ top: 4, right: 12, bottom: 0, left: -16 }}
                >
                  <CartesianGrid
                    strokeDasharray="0"
                    stroke={CHART_GRID}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: CHART_MUTED, fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fill: CHART_MUTED, fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Line
                    type="monotone"
                    dataKey="opens"
                    name="Opens"
                    stroke={SERIES_OPENS}
                    strokeWidth={2}
                    dot={{ r: 3, fill: SERIES_OPENS, strokeWidth: 0 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="clicks"
                    name="Clicks"
                    stroke={SERIES_CLICKS}
                    strokeWidth={2}
                    dot={{ r: 3, fill: SERIES_CLICKS, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {detail.top_links.length > 0 && (
            <div className="admin-data-panel mb-4">
              <table className="admin-sheet">
                <thead>
                  <tr>
                    <th>Link</th>
                    <th>Clicks</th>
                    <th>People</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.top_links.map((l) => (
                    <tr key={l.link}>
                      <td className="break-all">{l.link}</td>
                      <td>{l.clicks}</td>
                      <td>{l.people}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="admin-cats" role="group" aria-label="Filter recipients">
            {RECIPIENT_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                className={recipientStatus === f.key ? "is-on" : undefined}
                onClick={() => {
                  setRecipientStatus(f.key);
                  setRecipientPage(1);
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <input
            value={recipientSearch}
            onChange={(e) => {
              setRecipientSearch(e.target.value);
              setRecipientPage(1);
            }}
            placeholder="Search by email"
            className="mb-3 max-w-xs"
          />

          <div className="admin-data-panel">
            <table className="admin-sheet">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Opened</th>
                  <th>Clicked</th>
                </tr>
              </thead>
              <tbody>
                {recipients.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="admin-muted">
                      No recipients match that filter.
                    </td>
                  </tr>
                ) : (
                  recipients.map((r) => (
                    <tr key={r.email}>
                      <td>{r.email}</td>
                      <td className="admin-muted">{r.status}</td>
                      <td className="admin-muted">
                        {r.first_opened_at
                          ? `${fmtDate(r.first_opened_at)} (${r.open_count}×)`
                          : "—"}
                      </td>
                      <td className="admin-muted">
                        {r.first_clicked_at
                          ? `${fmtDate(r.first_clicked_at)} (${r.click_count}×)`
                          : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {recipientsTotal > RECIPIENT_PAGE_SIZE && (
            <div className="admin-row-acts mt-2">
              <button
                type="button"
                className="admin-edit"
                disabled={recipientPage <= 1}
                onClick={() => setRecipientPage((p) => p - 1)}
              >
                Previous
              </button>
              <span className="admin-muted text-xs">
                Page {recipientPage} of{" "}
                {Math.ceil(recipientsTotal / RECIPIENT_PAGE_SIZE)}
              </span>
              <button
                type="button"
                className="admin-edit"
                disabled={recipientPage * RECIPIENT_PAGE_SIZE >= recipientsTotal}
                onClick={() => setRecipientPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
