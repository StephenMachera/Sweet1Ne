"use client";

import { useState, type ReactNode } from "react";
import {
  BarChart,
  Body,
  BLUE,
  Empty,
  GOLD,
  Panel,
  RANGES,
  Table,
  kpiNote,
  useJson,
} from "./report-kit";

type Summary = {
  revenue: number;
  previous_revenue: number;
  orders: number;
  previous_orders: number;
  average_order_value: number | null;
  previous_average_order_value: number | null;
  cancelled_orders: number;
  cancelled_value: number;
  cancelled_share: number | null;
  qr_visits: number;
  qr_linked_orders: number;
  revenue_per_qr_visit: number | null;
  returning_guest_share: number | null;
};
type TrendDay = { date: string; revenue: number; orders: number; previous_revenue: number };
type Trend = { items: TrendDay[]; best_day: TrendDay | null; slowest_day: TrendDay | null };
type ByBranch = {
  items: { branch: string; revenue: number; orders: number; average_order_value: number | null; share: number | null }[];
};
type Heatmap = {
  blocks: string[];
  rows: { day: string; cells: number[]; other: number }[];
  best: { day: string; block: string; revenue: number } | null;
};
type Categories = { items: { name: string; revenue: number; sold: number; share: number | null }[] };
type Items = { items: { name: string; sold: number; revenue: number; average_price: number | null }[] };
type Channels = {
  items: { name: string; orders: number; revenue: number; share: number | null; average_order_value: number | null }[];
};
type Guests = {
  items: { name: string; visits: number; orders: number; revenue: number; per_visit: number | null }[];
};
type Promotions = {
  average_without_code: number | null;
  items: { code: string; used: number; average_with_code: number; difference: number | null }[];
};
type Tables = { items: { table: string; branch: string; orders: number; revenue: number }[] };
type StaffSales = {
  items: { name: string; orders: number; revenue: number; average_order_value: number | null }[];
};

const gbp0 = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });
const gbp2 = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const money = (n: number) => gbp0.format(n);
const money2 = (n: number | null) => (n === null ? "—" : gbp2.format(n));
const percent = (share: number | null) => (share === null ? "—" : `${Math.round(share * 100)}%`);

function change(now: number, before: number, days: number): string {
  if (before === 0) return now > 0 ? "New this period" : "No change";
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return `Level with the previous ${days} days`;
  return `${pct > 0 ? "Up" : "Down"} ${Math.abs(pct)}% on the previous ${days} days`;
}

function dayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function weekdayDay(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function ShareName({ name, share }: { name: string; share: number | null }) {
  return (
    <span className="block min-w-[8rem]">
      {name}
      <span className="rv-track" aria-hidden>
        <span style={{ width: `${Math.round((share ?? 0) * 100)}%` }} />
      </span>
    </span>
  );
}

function compactMoney(n: number): string {
  if (n === 0) return "—";
  return n >= 1000 ? `£${(n / 1000).toFixed(1)}k` : `£${Math.round(n)}`;
}

export function RevenueReport({ branchId = "" }: { branchId?: string }) {
  const [days, setDays] = useState(30);

  const q = `days=${days}${branchId ? `&branch_id=${branchId}` : ""}`;
  const summary = useJson<Summary>(`/reports/revenue/summary?${q}`);
  const trend = useJson<Trend>(`/reports/revenue/trend?${q}`);
  const byBranch = useJson<ByBranch>(`/reports/revenue/by-branch?${q}`);
  const heatmap = useJson<Heatmap>(`/reports/revenue/heatmap?${q}`);
  const categories = useJson<Categories>(`/reports/revenue/categories?${q}`);
  const items = useJson<Items>(`/reports/revenue/items?${q}&limit=8`);
  const channels = useJson<Channels>(`/reports/revenue/channels?${q}`);
  const guests = useJson<Guests>(`/reports/revenue/guests?${q}`);
  const promotions = useJson<Promotions>(`/reports/revenue/promotions?${q}`);
  const tables = useJson<Tables>(`/reports/revenue/tables?${q}&limit=8`);
  const staff = useJson<StaffSales>(`/reports/revenue/staff?${q}`);

  const s = summary.data;
  const heatMax = Math.max(
    0,
    ...(heatmap.data?.rows.flatMap((r) => [...r.cells, r.other]) ?? [])
  );

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

      <p className="rg-note">
        Cancelled orders are left out of every revenue figure on this tab. Figures that depend on QR
        visits fill in as guests scan, browse and order from the QR menu.
      </p>

      <section className="rg-kpis" aria-label="Totals">
        <article className="admin-card">
          <h2>Revenue</h2>
          <p className="admin-stat">{s ? money(s.revenue) : "—"}</p>
          <p>{kpiNote(summary, (d) => change(d.revenue, d.previous_revenue, days))}</p>
        </article>
        <article className="admin-card">
          <h2>Orders</h2>
          <p className="admin-stat">{s ? s.orders.toLocaleString("en-GB") : "—"}</p>
          <p>{kpiNote(summary, (d) => change(d.orders, d.previous_orders, days))}</p>
        </article>
        <article className="admin-card">
          <h2>Average order</h2>
          <p className="admin-stat">{money2(s?.average_order_value ?? null)}</p>
          <p>
            {kpiNote(summary, (d) =>
              d.average_order_value !== null && d.previous_average_order_value !== null
                ? change(d.average_order_value, d.previous_average_order_value, days)
                : "No previous period to compare"
            )}
          </p>
        </article>
        <article className="admin-card">
          <h2>Revenue per QR visit</h2>
          <p className="admin-stat">{money2(s?.revenue_per_qr_visit ?? null)}</p>
          <p>{kpiNote(summary, (d) => (d.qr_visits ? `${d.qr_visits.toLocaleString("en-GB")} visits` : "No QR visits yet"))}</p>
        </article>
        <article className="admin-card">
          <h2>Returning guests</h2>
          <p className="admin-stat">{percent(s?.returning_guest_share ?? null)}</p>
          <p>{kpiNote(summary, () => "Of QR visit revenue")}</p>
        </article>
        <article className="admin-card">
          <h2>Cancelled orders</h2>
          <p className="admin-stat">{s ? s.cancelled_orders.toLocaleString("en-GB") : "—"}</p>
          <p>{kpiNote(summary, (d) => `${money(d.cancelled_value)} not counted above`)}</p>
        </article>
      </section>

      <div className="rg-row">
        <Panel
          wide
          title="Revenue per day"
          dek={
            trend.data?.best_day
              ? `Best day: ${weekdayDay(trend.data.best_day.date)} (${money(trend.data.best_day.revenue)}).${
                  trend.data.slowest_day
                    ? ` Slowest: ${weekdayDay(trend.data.slowest_day.date)} (${money(trend.data.slowest_day.revenue)}).`
                    : ""
                }`
              : undefined
          }
        >
          <Body res={trend} isEmpty={(d) => !d.best_day}>
            {(d) => (
              <>
                <div className="admin-chart-legend">
                  <span>
                    <i style={{ background: GOLD }} />
                    This period (front bar)
                  </span>
                  <span>
                    <i style={{ background: "rgba(229,226,225,0.4)" }} />
                    Previous {days} days (behind)
                  </span>
                </div>
                <BarChart
                  overlay
                  money
                  sparseLabels
                  height={240}
                  names={["This period", "Previous period"]}
                  labels={d.items.map((i) => dayLabel(i.date))}
                  values={d.items.map((i) => i.revenue)}
                  compare={{ values: d.items.map((i) => i.previous_revenue), color: "rgba(229,226,225,0.4)" }}
                  label="Bar chart of revenue for each day, with the previous period behind it"
                />
              </>
            )}
          </Body>
        </Panel>
      </div>

      <div className="rg-row">
        <Panel title="Revenue by branch" dek="Which branch earns most, and how big an average order is.">
          <Body res={byBranch} isEmpty={(d) => d.items.length === 0}>
            {(d) => (
              <Table
                head={["Branch", "Revenue", "Orders", "Average"]}
                right={[1, 2, 3]}
                rows={d.items.map((b) => [
                  <ShareName key={b.branch} name={b.branch} share={b.share} />,
                  `${money(b.revenue)} · ${percent(b.share)}`,
                  b.orders.toLocaleString("en-GB"),
                  money2(b.average_order_value),
                ])}
              />
            )}
          </Body>
        </Panel>

        <Panel
          title="When the money comes in"
          dek="Revenue by weekday and time of day, in London time. Brighter means more."
        >
          <Body res={heatmap} isEmpty={() => heatMax === 0}>
            {(d) => (
              <>
                <div className="rv-heat" role="table" aria-label="Revenue by weekday and time of day">
                  <span />
                  {[...d.blocks, "Before 12"].map((b) => (
                    <span key={b} className="rv-heat-head">
                      {b}
                    </span>
                  ))}
                  {d.rows.map((row) => (
                    <HeatRow key={row.day} day={row.day} cells={[...row.cells, row.other]} max={heatMax} />
                  ))}
                </div>
                {d.best && (
                  <p className="rg-empty">
                    {d.best.day} {d.best.block} is the biggest block ({money(d.best.revenue)}).
                  </p>
                )}
              </>
            )}
          </Body>
        </Panel>
      </div>

      <div className="rg-row">
        <Panel title="Revenue by category" dek="Where the money comes from on the menu.">
          <Body res={categories} isEmpty={(d) => d.items.length === 0}>
            {(d) => (
              <>
                <BarChart
                  horizontal
                  money
                  height={Math.max(160, d.items.length * 34)}
                  labels={d.items.map((c) => c.name)}
                  values={d.items.map((c) => c.revenue)}
                  label="Bar chart of revenue by menu category"
                />
                <Table
                  head={["Category", "Revenue"]}
                  right={[1]}
                  rows={d.items.map((c) => [c.name, `${money(c.revenue)} · ${percent(c.share)}`])}
                />
              </>
            )}
          </Body>
        </Panel>

        <Panel title="Items that earn the most" dek="Ranked by money, not by how many were sold. The two lists can differ.">
          <Body res={items} isEmpty={(d) => d.items.length === 0}>
            {(d) => (
              <Table
                head={["Item", "Sold", "Revenue", "Avg price"]}
                right={[1, 2, 3]}
                rows={d.items.map((i) => [
                  i.name,
                  i.sold.toLocaleString("en-GB"),
                  money(i.revenue),
                  money2(i.average_price),
                ])}
              />
            )}
          </Body>
        </Panel>
      </div>

      <h2 className="rg-h2">Who orders, and how</h2>
      <div className="rg-row">
        <Panel title="QR menu orders and staff-placed orders" dek="Share of revenue by how the order was placed.">
          <Body res={channels} isEmpty={(d) => d.items.every((c) => c.orders === 0)}>
            {(d) => (
              <>
                <div className="rv-split" role="img" aria-label={`Revenue split: ${d.items.map((c) => `${c.name} ${percent(c.share)}`).join(", ")}`}>
                  <span style={{ width: `${(d.items[0].share ?? 0) * 100}%`, background: GOLD }} />
                  <span style={{ width: `${(d.items[1].share ?? 0) * 100}%`, background: BLUE }} />
                </div>
                <div className="admin-chart-legend">
                  <span>
                    <i style={{ background: GOLD }} />
                    {d.items[0].name}
                  </span>
                  <span>
                    <i style={{ background: BLUE }} />
                    {d.items[1].name}
                  </span>
                </div>
                <Table
                  head={["Placed by", "Orders", "Revenue", "Average"]}
                  right={[1, 2, 3]}
                  rows={d.items.map((c) => [
                    c.name,
                    c.orders.toLocaleString("en-GB"),
                    `${money(c.revenue)} (${percent(c.share)})`,
                    money2(c.average_order_value),
                  ])}
                />
              </>
            )}
          </Body>
        </Panel>

        <Panel
          title="New and returning guests"
          dek="What a QR visit is worth. Check this before giving regulars a discount."
        >
          <Body res={guests} isEmpty={(d) => d.items.every((g) => g.visits === 0)} empty="No QR visits in this period.">
            {(d) => (
              <>
                <Table
                  head={["Guests", "Visits", "Revenue", "Per visit"]}
                  right={[1, 2, 3]}
                  rows={d.items.map((g) => [
                    g.name,
                    g.visits.toLocaleString("en-GB"),
                    money(g.revenue),
                    money2(g.per_visit),
                  ])}
                />
                <p className="rg-empty">
                  Guests are counted by email, not by phone. Only orders linked to a QR visit are included.
                </p>
              </>
            )}
          </Body>
        </Panel>
      </div>

      <div className="rg-row">
        <Panel wide title="Promotion codes and spending" dek="Do guests who use a code spend more or less than guests who don't?">
          <Body res={promotions} isEmpty={(d) => d.items.length === 0} empty="No promotion codes were used in this period.">
            {(d) => (
              <Table
                head={["Code", "Used", "Average with code", "Average without", "Difference"]}
                right={[1, 2, 3, 4]}
                rows={d.items.map((p) => [
                  p.code,
                  p.used.toLocaleString("en-GB"),
                  money2(p.average_with_code),
                  money2(d.average_without_code),
                  p.difference === null
                    ? "—"
                    : `${p.difference >= 0 ? "Up" : "Down"} ${Math.abs(Math.round(p.difference * 100))}%`,
                ])}
              />
            )}
          </Body>
          <p className="rg-empty">
            This compares spending only. It cannot show what the discounts cost you, because the amount taken off
            is not saved on orders yet. Only code promotions are counted.
          </p>
        </Panel>
      </div>

      <div className="rg-row">
        <Panel title="Revenue by table" dek="The tables that earn most.">
          <Body res={tables} isEmpty={(d) => d.items.length === 0}>
            {(d) => (
              <Table
                head={["Table", "Branch", "Orders", "Revenue"]}
                right={[2, 3]}
                rows={d.items.map((t) => [t.table, t.branch, t.orders.toLocaleString("en-GB"), money(t.revenue)])}
              />
            )}
          </Body>
        </Panel>

        <Panel title="Cancelled orders" dek="Money that was on an order and never came in.">
          <Body res={summary} isEmpty={() => false}>
            {(d) => (
              <>
                <div className="rv-facts">
                  <div>
                    <span>Orders</span>
                    <strong>{d.cancelled_orders.toLocaleString("en-GB")}</strong>
                  </div>
                  <div>
                    <span>Value</span>
                    <strong>{money(d.cancelled_value)}</strong>
                  </div>
                  <div>
                    <span>Share of orders</span>
                    <strong>{d.cancelled_share === null ? "—" : `${(d.cancelled_share * 100).toFixed(1)}%`}</strong>
                  </div>
                </div>
                <p className="rg-empty">These are not included in any revenue figure on this tab.</p>
              </>
            )}
          </Body>
        </Panel>
      </div>

      <div className="rg-row">
        <Panel
          wide
          title="Sales by who placed the order"
          dek="Orders placed by staff for guests. QR orders are not in this list."
          tag="Central staff only"
        >
          {staff.failed ? (
            <Empty>Only central staff can see sales by person.</Empty>
          ) : (
            <Body res={staff} isEmpty={(d) => d.items.length === 0}>
              {(d) => (
                <Table
                  head={["Staff", "Orders", "Revenue", "Average"]}
                  right={[1, 2, 3]}
                  rows={d.items.map((p) => [
                    p.name,
                    p.orders.toLocaleString("en-GB"),
                    money(p.revenue),
                    money2(p.average_order_value),
                  ])}
                />
              )}
            </Body>
          )}
        </Panel>
      </div>

      <div className="rg-row">
        <Panel
          wide
          sample
          title="Not shown yet, and why"
          dek="These are left out on purpose, so nothing here is a guess."
        >
          <Table
            head={["", ""]}
            rows={[
              ["Profit and margin", "Needs what each dish costs to make. Only revenue is recorded today."],
              ["Payment methods", "Not recorded on orders, so card and cash cannot be split."],
              ["Tips and refunds", "Not recorded on orders."],
              ["Revenue forecast", "Needs about eight weeks of real orders before a forecast means anything."],
            ]}
          />
        </Panel>
      </div>
    </>
  );
}

function HeatRow({ day, cells, max }: { day: string; cells: number[]; max: number }): ReactNode {
  return (
    <>
      <span className="rv-heat-day">{day}</span>
      {cells.map((value, i) => (
        <span
          key={i}
          className="rv-heat-cell"
          style={{ background: `rgba(201,162,74,${value > 0 ? (0.08 + 0.55 * (value / max)).toFixed(2) : 0.03})` }}
          title={value > 0 ? `${gbp0.format(value)}` : undefined}
        >
          {compactMoney(value)}
        </span>
      ))}
    </>
  );
}
