"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  Tooltip,
  type ChartOptions,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { apiFetch } from "@/lib/api";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

// ───────────────────────── types ─────────────────────────

type Summary = { orders: number; previous_orders: number; leads: number; previous_leads: number };
type BestSellers = {
  top_items: { name: string; sold: number; best_day: string; best_time: string | null }[];
  best_day: string | null;
  busiest_time: string | null;
};
type Promotions = {
  made: number;
  peak_time: string | null;
  running: { kind: string; label: string | null; code: string | null; ends_at: string | null; uses: number | null }[];
};
type Events = {
  made: number;
  items: { title: string; starts_at: string | null; is_published: boolean; page_visits: number | null }[];
};
type Inbox = { total: number; unread: number; by_hour: number[]; by_weekday: Record<string, number> };
type GuestCounts = { new: number; active: number; returning: number };
type PageVisits = {
  total_views: number;
  by_hour: number[];
  by_weekday: Record<string, number>;
  top_pages: { path: string; views: number; best_day: string; best_time: string | null }[];
};
type MenuActivity = {
  total_adds: number;
  most_added: { name: string; count: number }[];
};
type Searches = {
  total: number;
  not_found_total: number;
  most_searched: { text: string; count: number }[];
  not_found: { text: string; count: number }[];
};
type TableScans = {
  total_visits: number;
  items: { table: string; branch: string; visits: number; people: number; best_day: string; best_time: string | null }[];
};
type EmailLinks = {
  items: { link: string; clicks: number; people: number; campaigns: number }[];
};
type Connectable = { connected: boolean };
type QrGuests = {
  devices: GuestCounts;
  people: GuestCounts;
  visits: number;
  subscribed_share: number | null;
};
type EmailOverview = { campaigns: number; sent: number; delivered: number; opened: number; clicked: number };
type EmailCampaigns = {
  items: { campaign_id: string; name: string; sent_at: string | null; sent: number; clicked: number }[];
};

// ───────────────────────── data ─────────────────────────

/** Loads a URL and only ever sets state from the response callback, so a
 * range or branch change shows the previous numbers until the new ones land
 * rather than flashing empty. */
function useJson<T>(url: string | null) {
  const [state, setState] = useState<{ url: string; data: T | null; failed: boolean } | null>(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    apiFetch(url)
      .then((data: T) => !cancelled && setState({ url, data, failed: false }))
      .catch(() => !cancelled && setState({ url, data: null, failed: true }));
    return () => {
      cancelled = true;
    };
  }, [url]);

  return {
    data: state?.data ?? null,
    loading: !!url && state?.url !== url,
    failed: state?.url === url && state.failed,
  };
}

type Res<T> = { data: T | null; loading: boolean; failed: boolean };

const PAGE_NAMES: Record<string, string> = {
  "/": "Home",
  "/menu": "Menu",
  "/order": "Order",
  "/story": "Our story",
  "/events": "Events",
  "/locations": "Book a table",
  "/contact": "Contact",
  "/privacy": "Privacy",
  "/terms": "Terms",
};

function friendlyPath(path: string): string {
  if (PAGE_NAMES[path]) return PAGE_NAMES[path];
  if (path.startsWith("/events/")) return `Event: ${path.slice(8)}`;
  return path;
}

function hourLabel(hour: number): string {
  const h = hour % 24;
  return `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;
}

const HOURS = Array.from({ length: 24 }, (_, h) => hourLabel(h));
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// ───────────────────────── charts ─────────────────────────

// Validated against the admin's dark surface (see the Email activity tab):
// #c9a24a for the main series, #3987e5 for a second one.
const GOLD = "#c9a24a";
const BLUE = "#3987e5";
const INK = "#e5e2e1";
const MUTED = "rgba(229, 226, 225, 0.58)";
const GRID = "rgba(229, 226, 225, 0.08)";

/** Mounts its children only once scrolled into view, so a chart further
 * down the page plays its grow-in animation when the reader gets to it
 * instead of finishing off-screen. */
function Reveal({ height, children }: { height: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ height }}>
      {shown ? children : null}
    </div>
  );
}

function BarChart({
  labels,
  values,
  color = GOLD,
  horizontal = false,
  height = 220,
  label,
  compare,
  sparseLabels = false,
}: {
  labels: string[];
  values: number[];
  color?: string;
  horizontal?: boolean;
  height?: number;
  label: string;
  compare?: { values: number[]; color: string };
  sparseLabels?: boolean;
}) {
  const options: ChartOptions<"bar"> = {
    indexAxis: horizontal ? "y" : "x",
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 900, easing: "easeOutQuart" },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#0c0c0c",
        borderColor: "rgba(201, 162, 74, 0.35)",
        borderWidth: 1,
        titleColor: INK,
        bodyColor: INK,
        displayColors: false,
      },
    },
    scales: {
      x: {
        grid: { color: horizontal ? GRID : "transparent" },
        ticks: { color: MUTED, font: { size: 11 }, maxRotation: 0, autoSkip: sparseLabels, maxTicksLimit: sparseLabels ? 8 : undefined },
        border: { color: GRID },
      },
      y: {
        beginAtZero: true,
        grid: { color: horizontal ? "transparent" : GRID },
        ticks: { color: MUTED, font: { size: 11 }, precision: 0 },
        border: { color: GRID },
      },
    },
  };

  return (
    <Reveal height={height}>
      <div role="img" aria-label={label} style={{ height }}>
        <Bar
          options={options}
          data={{
            labels,
            datasets: [
              { data: values, backgroundColor: color, borderRadius: 3, maxBarThickness: 44 },
              ...(compare
                ? [{ data: compare.values, backgroundColor: compare.color, borderRadius: 3, maxBarThickness: 44 }]
                : []),
            ],
          }}
        />
      </div>
    </Reveal>
  );
}

// ───────────────────────── small pieces ─────────────────────────

function Tag({ children }: { children: ReactNode }) {
  return <span className="rg-tag">{children}</span>;
}

function Panel({
  title,
  dek,
  tag,
  sample,
  wide,
  children,
}: {
  title: string;
  dek?: string;
  tag?: string;
  sample?: boolean;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <article className={`rg-panel${sample ? " is-sample" : ""}${wide ? " is-wide" : ""}`}>
      <div className="rg-panel-head">
        <div>
          <h3>{title}</h3>
          {dek && <p>{dek}</p>}
        </div>
        {tag && <Tag>{tag}</Tag>}
      </div>
      {children}
    </article>
  );
}

function Table({ head, rows, right = [] }: { head: string[]; rows: ReactNode[][]; right?: number[] }) {
  return (
    <div className="admin-data-panel">
      <table className="admin-sheet">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={h} style={right.includes(i) ? { textAlign: "right" } : undefined}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, i) => (
                <td
                  key={i}
                  className={i === 0 ? undefined : "admin-muted"}
                  style={right.includes(i) ? { textAlign: "right" } : undefined}
                >
                  {i === 0 ? <span className="admin-name">{cell}</span> : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rg-empty">{children}</p>;
}

function trend(now: number, before: number): string {
  if (before === 0) return now > 0 ? "New this period" : "No change";
  const pct = Math.round(((now - before) / before) * 100);
  return pct === 0 ? "Level with the last period" : `${pct > 0 ? "Up" : "Down"} ${Math.abs(pct)}% on the last period`;
}

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

// ───────────────────────── the tab ─────────────────────────

/** One card's own loading, error and empty states, so a single failing
 * endpoint never blanks the rest of the tab. */
function Body<T>({
  res,
  isEmpty,
  empty = "No data yet.",
  children,
}: {
  res: Res<T>;
  isEmpty?: (data: T) => boolean;
  empty?: string;
  children: (data: T) => ReactNode;
}) {
  if (res.failed) return <Empty>Couldn&apos;t load this. Try again in a moment.</Empty>;
  if (!res.data) return <Empty>Loading…</Empty>;
  if (isEmpty?.(res.data)) return <Empty>{empty}</Empty>;
  return <>{children(res.data)}</>;
}

function NotTracked({ title, dek, tag = "Not tracked yet", wide }: { title: string; dek?: string; tag?: string; wide?: boolean }) {
  return (
    <Panel sample wide={wide} title={title} dek={dek} tag={tag}>
      <Empty>Nothing records this yet, so there is no figure to show. It is not zero.</Empty>
    </Panel>
  );
}

function kpiNote<T>(res: Res<T>, text: (data: T) => string): string {
  if (res.failed) return "Couldn't load";
  return res.data ? text(res.data) : "Loading…";
}

// ───────────────────────── the tab ─────────────────────────

export function GeneralReport({ branchId = "" }: { branchId?: string }) {
  const [days, setDays] = useState(30);

  const q = `days=${days}${branchId ? `&branch_id=${branchId}` : ""}`;
  const summary = useJson<Summary>(`/reports/general/summary?${q}`);
  const sellers = useJson<BestSellers>(`/reports/general/best-sellers?${q}&limit=8`);
  const promos = useJson<Promotions>(`/reports/general/promotions?${q}`);
  const events = useJson<Events>(`/reports/general/events?${q}`);
  const inbox = useJson<Inbox>(`/reports/general/inbox?${q}`);
  const pages = useJson<PageVisits>(`/reports/general/page-visits?${q}&source=website`);
  const qr = useJson<QrGuests>(`/reports/general/qr-guests?${q}`);
  const menuActivity = useJson<MenuActivity>(`/reports/general/menu-activity?${q}&source=qr_menu`);
  const tableScans = useJson<TableScans>(`/reports/general/table-scans?${q}`);
  const searches = useJson<Searches>(`/reports/general/searches?${q}&source=qr_menu`);
  const reservations = useJson<Connectable>("/reports/general/reservations");
  const takeaway = useJson<Connectable>("/reports/general/takeaway");
  // Central office only: a branch login is refused here, which leaves the
  // campaign cards on their error state instead of blanking the tab.
  const email = useJson<EmailOverview>(`/email-analytics/overview?days=${days}`);
  const emailLinks = useJson<EmailLinks>(`/email-analytics/links?days=${days}&limit=5`);
  const campaigns = useJson<EmailCampaigns>(`/email-analytics/campaigns?days=${days}&page_size=5`);

  const num = (n: number | undefined) => (n === undefined ? "—" : n.toLocaleString("en-GB"));
  const topSeller = sellers.data?.top_items[0];
  const reservationsConnected = reservations.data?.connected === true;
  const takeawayConnected = takeaway.data?.connected === true;

  return (
    <>
      <div className="rg-controls" role="group" aria-label="Period">
        {RANGES.map((r) => (
          <button
            key={r.days}
            type="button"
            className={days === r.days ? "is-on" : undefined}
            onClick={() => setDays(r.days)}
          >
            Last {r.label}
          </button>
        ))}
      </div>

      <section className="rg-kpis" aria-label="Totals">
        <article className="admin-card">
          <h2>Total orders</h2>
          <p className="admin-stat">{num(summary.data?.orders)}</p>
          <p>{kpiNote(summary, (d) => trend(d.orders, d.previous_orders))}</p>
        </article>
        <article className="admin-card">
          <h2>New leads</h2>
          <p className="admin-stat">{num(summary.data?.leads)}</p>
          <p>{kpiNote(summary, (d) => trend(d.leads, d.previous_leads))}</p>
        </article>
        <article className="admin-card">
          <h2>Campaigns sent</h2>
          <p className="admin-stat">{num(email.data?.campaigns)}</p>
          <p>{email.failed ? "Central office only" : kpiNote(email, (d) => `${d.sent.toLocaleString("en-GB")} emails sent`)}</p>
        </article>
        <article className="admin-card is-wait">
          <h2>Reservations</h2>
          <p className="admin-stat admin-hold">—</p>
          <p>{reservationsConnected ? "Connected" : "Not connected. Handled in SevenRooms."}</p>
        </article>
        <article className="admin-card">
          <h2>Inbox messages</h2>
          <p className="admin-stat">{num(inbox.data?.total)}</p>
          <p>{kpiNote(inbox, (d) => `${d.unread} unread`)}</p>
        </article>
        <article className="admin-card">
          <h2>QR menu guests</h2>
          <p className="admin-stat">{num(qr.data?.people.active)}</p>
          <p>
            {kpiNote(qr, (d) => `${d.people.new} new, ${d.people.returning} returning · ${d.visits} visits`)}
          </p>
        </article>
      </section>

      <div className="rg-row">
        <Panel title="Email campaigns" dek="When each was sent and how many people it reached.">
          <Body res={campaigns} isEmpty={(d) => d.items.length === 0}>
            {(d) => (
              <Table
                head={["Campaign", "Sent", "Reached", "Clicked"]}
                right={[2, 3]}
                rows={d.items.map((c) => [
                  c.name,
                  shortDate(c.sent_at),
                  c.sent.toLocaleString("en-GB"),
                  c.sent ? `${((c.clicked / c.sent) * 100).toFixed(1)}%` : "—",
                ])}
              />
            )}
          </Body>
          <Link className="rg-link" href="/admin/marketing">
            Open email activity →
          </Link>
        </Panel>

        <Panel title="Most clicked links in emails" dek="Across all campaigns in this period.">
          <Body res={emailLinks} isEmpty={(d) => d.items.length === 0}>
            {(d) => (
              <Table
                head={["Link", "Clicks", "People", "Campaigns"]}
                right={[1, 2, 3]}
                rows={d.items.map((l) => [friendlyPath(l.link), l.clicks, l.people, l.campaigns])}
              />
            )}
          </Body>
        </Panel>
      </div>

      <h2 className="rg-h2">What sells</h2>
      <section className="rg-kpis" aria-label="Best sellers">
        <article className="admin-card">
          <h2>Top seller</h2>
          <p className="admin-stat rg-stat-text">{topSeller?.name ?? "—"}</p>
          <p>{kpiNote(sellers, (d) => (d.top_items[0] ? `${d.top_items[0].sold.toLocaleString("en-GB")} sold` : "No data yet"))}</p>
        </article>
        <article className="admin-card">
          <h2>Best day for sales</h2>
          <p className="admin-stat rg-stat-text">{sellers.data?.best_day ?? "—"}</p>
          <p>Most items sold</p>
        </article>
        <article className="admin-card">
          <h2>Busiest time</h2>
          <p className="admin-stat rg-stat-text">{sellers.data?.busiest_time ?? "—"}</p>
          <p>Peak two hours</p>
        </article>
      </section>
      <div className="rg-row">
        <Panel title="Items sold" dek="Top items by quantity.">
          <Body res={sellers} isEmpty={(d) => d.top_items.length === 0}>
            {(d) => (
              <BarChart
                horizontal
                height={Math.max(180, d.top_items.length * 34)}
                labels={d.top_items.map((i) => i.name)}
                values={d.top_items.map((i) => i.sold)}
                label="Bar chart of the best selling menu items"
              />
            )}
          </Body>
        </Panel>
        <Panel title="Best day and time per item">
          <Body res={sellers} isEmpty={(d) => d.top_items.length === 0}>
            {(d) => (
              <Table
                head={["Item", "Sold", "Best day", "Best time"]}
                right={[1]}
                rows={d.top_items.map((i) => [i.name, i.sold, i.best_day, i.best_time ?? "—"])}
              />
            )}
          </Body>
        </Panel>
      </div>

      <div className="rg-row">
        <Panel
          title="Promotions"
          dek={promos.data ? `${promos.data.made} made in this period.${promos.data.peak_time ? ` Most used ${promos.data.peak_time}.` : ""}` : undefined}
        >
          <Body res={promos} isEmpty={(d) => d.running.length === 0} empty="No promotion is running.">
            {(d) => (
              <Table
                head={["Promotion", "Type", "Ends", "Used"]}
                right={[3]}
                rows={d.running.map((p) => [
                  p.label ?? p.code ?? "—",
                  p.kind,
                  p.ends_at ? shortDate(p.ends_at) : "Open",
                  p.uses ?? "Not tracked",
                ])}
              />
            )}
          </Body>
        </Panel>

        <Panel
          title="Events"
          dek={events.data ? `${events.data.made} made in this period.` : "When each was made and how many looked at its page."}
        >
          <Body res={events} isEmpty={(d) => d.items.length === 0}>
            {(d) => (
              <Table
                head={["Event", "Date", "Page visits"]}
                right={[2]}
                rows={d.items.map((e) => [e.title, shortDate(e.starts_at), e.page_visits ?? "Not tracked"])}
              />
            )}
          </Body>
        </Panel>
      </div>

      <h2 className="rg-h2">Website</h2>
      <div className="rg-row">
        <Panel
          title="Page visits"
          dek={pages.data ? `${pages.data.total_views.toLocaleString("en-GB")} page views. Which pages are visited most, and when they peak.` : undefined}
        >
          <Body res={pages} isEmpty={(d) => d.total_views === 0}>
            {(d) => (
              <>
                <Table
                  head={["Page", "Visits", "Best day", "Best time"]}
                  right={[1]}
                  rows={d.top_pages.map((p) => [friendlyPath(p.path), p.views, p.best_day, p.best_time ?? "—"])}
                />
                <BarChart
                  height={160}
                  labels={WEEKDAYS.map((w) => w.slice(0, 3))}
                  values={WEEKDAYS.map((w) => d.by_weekday[w] ?? 0)}
                  label="Bar chart of page views by day of the week"
                />
                <BarChart
                  height={160}
                  sparseLabels
                  labels={HOURS}
                  values={d.by_hour}
                  label="Bar chart of page views by hour of the day, London time"
                />
              </>
            )}
          </Body>
        </Panel>

        <Panel title="QR menu guests" dek="People who gave their email at a table, and the phones they used.">
          <Body res={qr} isEmpty={(d) => d.people.active === 0 && d.devices.active === 0}>
            {(d) => (
              <>
                <div className="admin-chart-legend">
                  <span>
                    <i style={{ background: GOLD }} />
                    People
                  </span>
                  <span>
                    <i style={{ background: BLUE }} />
                    Devices
                  </span>
                </div>
                <BarChart
                  height={200}
                  labels={["Active", "New", "Returning"]}
                  values={[d.people.active, d.people.new, d.people.returning]}
                  compare={{ values: [d.devices.active, d.devices.new, d.devices.returning], color: BLUE }}
                  label="Bar chart of active, new and returning QR menu guests, as people and as devices"
                />
                <p className="rg-empty">
                  {d.visits} visits ·{" "}
                  {d.subscribed_share === null
                    ? "no newsletter data yet"
                    : `${Math.round(d.subscribed_share * 100)}% of people ticked the newsletter box`}
                </p>
              </>
            )}
          </Body>
        </Panel>
      </div>

      <h2 className="rg-h2">On the QR menu</h2>
      <div className="rg-row rg-row-4">
        <Panel
          title="Most added to the basket"
          dek={menuActivity.data ? `${menuActivity.data.total_adds.toLocaleString("en-GB")} adds in this period.` : undefined}
        >
          <Body res={menuActivity} isEmpty={(d) => d.most_added.length === 0}>
            {(d) => <Table head={["Dish", "Added"]} right={[1]} rows={d.most_added.map((i) => [i.name, i.count])} />}
          </Body>
        </Panel>
        <Panel
          title="Most searched"
          dek={searches.data ? `${searches.data.total.toLocaleString("en-GB")} searches in this period.` : undefined}
        >
          <Body res={searches} isEmpty={(d) => d.most_searched.length === 0}>
            {(d) => <Table head={["Search", "Times"]} right={[1]} rows={d.most_searched.map((i) => [i.text, i.count])} />}
          </Body>
        </Panel>
        <Panel
          title="Searched but not found"
          dek={
            searches.data
              ? `${searches.data.not_found_total.toLocaleString("en-GB")} searches found nothing. What guests wanted that the menu doesn't have.`
              : "What guests wanted that the menu doesn't have."
          }
        >
          <Body res={searches} isEmpty={(d) => d.not_found.length === 0}>
            {(d) => <Table head={["Search", "Times"]} right={[1]} rows={d.not_found.map((i) => [i.text, i.count])} />}
          </Body>
        </Panel>
        <Panel
          title="Tables whose QR code is used most"
          dek={tableScans.data ? `${tableScans.data.total_visits.toLocaleString("en-GB")} visits in this period.` : undefined}
        >
          <Body res={tableScans} isEmpty={(d) => d.items.length === 0}>
            {(d) => (
              <Table
                head={["Table", "Visits", "People", "Best time"]}
                right={[1, 2]}
                rows={d.items.map((t) => [
                  `${t.table} · ${t.branch}`,
                  t.visits,
                  t.people,
                  t.best_time ? `${t.best_day.slice(0, 3)}, ${t.best_time}` : t.best_day,
                ])}
              />
            )}
          </Body>
        </Panel>
      </div>

      <h2 className="rg-h2">Bookings and messages</h2>
      <div className="rg-row">
        {reservationsConnected ? null : (
          <NotTracked
            wide
            tag="Not connected"
            title="Reservations by day"
            dek="Bookings are made in SevenRooms. This fills in when it is connected."
          />
        )}
      </div>
      <div className="rg-row">
        <Panel title="Inbox" dek={inbox.data ? `${inbox.data.total} messages received. When they arrive.` : undefined}>
          <Body res={inbox} isEmpty={(d) => d.total === 0}>
            {(d) => (
              <>
                <BarChart
                  height={200}
                  color={BLUE}
                  sparseLabels
                  labels={HOURS}
                  values={d.by_hour}
                  label="Bar chart of inbox messages by hour of the day, London time"
                />
                <BarChart
                  height={160}
                  color={BLUE}
                  labels={WEEKDAYS.map((w) => w.slice(0, 3))}
                  values={WEEKDAYS.map((w) => d.by_weekday[w] ?? 0)}
                  label="Bar chart of inbox messages by day of the week"
                />
              </>
            )}
          </Body>
        </Panel>

        {takeawayConnected ? null : (
          <NotTracked
            tag="Not connected"
            title="Takeaway requests (external service)"
            dek="Which items are asked for most, and when."
          />
        )}
      </div>
    </>
  );
}
