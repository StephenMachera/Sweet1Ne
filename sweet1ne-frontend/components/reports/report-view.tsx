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
import { Printer, TrendingDown, TrendingUp } from "lucide-react";
import { apiFetch } from "@/lib/api";

type TrendPoint = { label: string; revenue: number; orders: number };
type BranchBreakdown = {
  branch_id: string;
  branch_name: string;
  revenue: number;
  orders: number;
  average_order_value: number;
};
type NamedTotal = { id: string; name: string; revenue: number; quantity: number };
type StaffActivity = { staff_id: string | null; name: string; orders: number; revenue: number };

type Report = {
  period: string;
  range_label: string;
  revenue: number;
  orders: number;
  average_order_value: number;
  previous_revenue: number;
  previous_orders: number;
  trend: TrendPoint[];
  by_branch: BranchBreakdown[];
  by_category: NamedTotal[];
  top_items: NamedTotal[];
  bottom_items: NamedTotal[];
  by_hour: TrendPoint[];
  by_staff: StaffActivity[];
};

type Branch = { id: string; name: string };

const PERIODS = [
  { key: "daily", label: "Today" },
  { key: "weekly", label: "This week" },
  { key: "monthly", label: "This month" },
  { key: "yearly", label: "This year" },
];

type Palette = {
  accent: string;
  accentSoft: string;
  text: string;
  muted: string;
  card: string;
  border: string;
  activeTab: string;
  inactiveTab: string;
  positive: string;
  negative: string;
  series: string[];
};

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const gbpPrecise = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

/** Recharts types chart values loosely — they could be strings or arrays —
 *  so narrow here rather than asserting at every call site. */
function formatMoney(value: unknown): string {
  return typeof value === "number" ? gbpPrecise.format(value) : String(value ?? "");
}

function formatAxisMoney(value: unknown): string {
  return typeof value === "number" ? gbp.format(value) : String(value ?? "");
}

/** Percentage change against the previous comparable period. */
function delta(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

const TOOLTIP_STYLE = {
  borderRadius: 10,
  fontSize: 13,
  border: "1px solid rgba(0,0,0,0.08)",
};

export function ReportView({
  title,
  palette,
  showBranchComparison,
}: {
  title: string;
  palette: Palette;
  /** Directors only — enables the branch filter and comparison chart. */
  showBranchComparison: boolean;
}) {
  const [period, setPeriod] = useState("weekly");
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!showBranchComparison) return;
    apiFetch("/branches")
      .then((list) => setBranches(list.map((b: any) => ({ id: b.id, name: b.name }))))
      .catch(() => setBranches([]));
  }, [showBranchComparison]);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ period });
    if (branchId) params.set("branch_id", branchId);

    return apiFetch(`/reports/report?${params.toString()}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [period, branchId]);

  useEffect(() => {
    load();
  }, [load]);

  const revenueDelta = data ? delta(data.revenue, data.previous_revenue) : 0;
  const ordersDelta = data ? delta(data.orders, data.previous_orders) : 0;
  const selectedBranchName = branches.find((b) => b.id === branchId)?.name;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className={`text-2xl font-semibold sm:text-3xl ${palette.text}`}>{title}</h1>
          <p className={`mt-1 text-sm ${palette.muted}`}>
            {data?.range_label ?? "—"}
            {selectedBranchName && ` · ${selectedBranchName}`}
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className={`inline-flex h-10 items-center gap-1.5 rounded-lg border px-4 text-sm ${palette.border} ${palette.muted}`}
        >
          <Printer size={15} />
          Print report
        </button>
      </div>

      {/* Print-only header */}
      <div className="hidden print:block">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm">
          {data?.range_label}
          {selectedBranchName && ` · ${selectedBranchName}`} · generated{" "}
          {new Date().toLocaleDateString("en-GB")}
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {/* Period tabs */}
      <div className="flex flex-wrap gap-2 print:hidden">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              period === p.key ? palette.activeTab : palette.inactiveTab
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Branch filter — directors only */}
      {showBranchComparison && branches.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <span className={`text-xs uppercase tracking-[0.14em] ${palette.muted}`}>Branch</span>
          <button
            onClick={() => setBranchId("")}
            className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
              branchId === "" ? palette.activeTab : palette.inactiveTab
            }`}
          >
            All branches
          </button>
          {branches.map((b) => (
            <button
              key={b.id}
              onClick={() => setBranchId(branchId === b.id ? "" : b.id)}
              className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                branchId === b.id ? palette.activeTab : palette.inactiveTab
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      {loading || !data ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`rounded-xl border p-5 ${palette.border} ${palette.card}`}>
              <div className="h-3 w-20 animate-pulse rounded bg-black/5" />
              <div className="mt-4 h-8 w-28 animate-pulse rounded bg-black/5" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Headline figures */}
          <section className="grid gap-4 sm:grid-cols-3">
            <Kpi
              palette={palette}
              label="Revenue"
              value={gbp.format(data.revenue)}
              change={revenueDelta}
            />
            <Kpi palette={palette} label="Orders" value={String(data.orders)} change={ordersDelta} />
            <Kpi
              palette={palette}
              label="Average order"
              value={gbpPrecise.format(data.average_order_value)}
            />
          </section>

          {/* Trend */}
          <Panel palette={palette} title="Revenue over time">
            {data.trend.length === 0 ? (
              <EmptyChart palette={palette} />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.trend} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={formatAxisMoney}
                  />
                  <Tooltip formatter={formatMoney} contentStyle={TOOLTIP_STYLE} />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke={palette.accent}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: palette.accent }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Panel>

          {/* Branch comparison — hidden when drilled into one branch */}
          {showBranchComparison && !branchId && data.by_branch.length > 1 && (
            <Panel palette={palette} title="By branch">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.by_branch} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                  <XAxis
                    dataKey="branch_name"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={formatAxisMoney}
                  />
                  <Tooltip formatter={formatMoney} contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                    {data.by_branch.map((_, i) => (
                      <Cell key={i} fill={palette.series[i % palette.series.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr
                      className={`border-b text-left text-[11px] uppercase tracking-[0.12em] ${palette.border} ${palette.muted}`}
                    >
                      <th className="py-2 font-normal">Branch</th>
                      <th className="py-2 text-right font-normal">Orders</th>
                      <th className="py-2 text-right font-normal">Revenue</th>
                      <th className="py-2 text-right font-normal">Avg.</th>
                      <th className="py-2 text-right font-normal print:hidden" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_branch.map((b) => (
                      <tr key={b.branch_id} className="border-b border-black/5 last:border-0">
                        <td className={`py-2.5 ${palette.text}`}>{b.branch_name}</td>
                        <td className={`py-2.5 text-right tabular-nums ${palette.text}`}>
                          {b.orders}
                        </td>
                        <td className={`py-2.5 text-right tabular-nums ${palette.text}`}>
                          {gbp.format(b.revenue)}
                        </td>
                        <td className={`py-2.5 text-right tabular-nums ${palette.muted}`}>
                          {gbpPrecise.format(b.average_order_value)}
                        </td>
                        <td className="py-2.5 text-right print:hidden">
                          <button
                            onClick={() => setBranchId(b.branch_id)}
                            className={`text-xs underline underline-offset-4 ${palette.muted}`}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Categories — horizontal bars read better than a pie */}
            <Panel palette={palette} title="By category">
              {data.by_category.length === 0 ? (
                <EmptyChart palette={palette} />
              ) : (
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(180, data.by_category.length * 42)}
                >
                  <BarChart
                    data={data.by_category}
                    layout="vertical"
                    margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(0,0,0,0.06)"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={formatAxisMoney}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={90}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip formatter={formatMoney} contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                      {data.by_category.map((_, i) => (
                        <Cell key={i} fill={palette.series[i % palette.series.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Panel>

            {/* Busiest hours */}
            <Panel palette={palette} title="Busiest hours">
              {data.by_hour.length === 0 ? (
                <EmptyChart palette={palette} />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.by_hour} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(0,0,0,0.06)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="orders" fill={palette.accent} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Panel>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel palette={palette} title="Best sellers">
              <RankedList items={data.top_items} palette={palette} />
            </Panel>

            {data.bottom_items.length > 0 && (
              <Panel palette={palette} title="Slowest movers">
                <RankedList items={data.bottom_items} palette={palette} muted />
              </Panel>
            )}
          </div>

          {/* Who placed orders */}
          {data.by_staff.length > 0 && (
            <Panel palette={palette} title="Orders by source">
              <ul className="space-y-2.5">
                {data.by_staff.map((s) => {
                  const share = data.orders > 0 ? (s.orders / data.orders) * 100 : 0;
                  return (
                    <li key={s.staff_id ?? "qr"} className="flex items-center gap-3">
                      <span className={`w-36 shrink-0 truncate text-sm ${palette.text}`}>
                        {s.name}
                      </span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-black/5">
                        <span
                          className="block h-full rounded-full"
                          style={{ width: `${share}%`, background: palette.accent }}
                        />
                      </span>
                      <span className={`w-10 text-right text-sm tabular-nums ${palette.muted}`}>
                        {s.orders}
                      </span>
                      <span className={`w-20 text-right text-sm tabular-nums ${palette.text}`}>
                        {gbp.format(s.revenue)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */

function Kpi({
  palette,
  label,
  value,
  change,
}: {
  palette: Palette;
  label: string;
  value: string;
  change?: number;
}) {
  return (
    <div className={`rounded-xl border p-5 ${palette.border} ${palette.card}`}>
      <p className={`text-[11px] uppercase tracking-[0.14em] ${palette.muted}`}>{label}</p>
      <div className="mt-2.5 flex items-end gap-3">
        <p className={`text-3xl font-semibold tabular-nums ${palette.text}`}>{value}</p>
        {change !== undefined && change !== 0 && (
          <span
            className={`mb-1 inline-flex items-center gap-1 text-sm font-medium ${
              change > 0 ? palette.positive : palette.negative
            }`}
          >
            {change > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {Math.abs(change)}%
          </span>
        )}
      </div>
      {change !== undefined && <p className={`mt-1 text-xs ${palette.muted}`}>vs. previous period</p>}
    </div>
  );
}

function Panel({
  palette,
  title,
  children,
}: {
  palette: Palette;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`break-inside-avoid overflow-hidden rounded-xl border ${palette.border} ${palette.card}`}
    >
      <div className={`border-b px-5 py-3.5 ${palette.border}`}>
        <h2 className={`font-semibold ${palette.text}`}>{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function RankedList({
  items,
  palette,
  muted = false,
}: {
  items: NamedTotal[];
  palette: Palette;
  muted?: boolean;
}) {
  if (items.length === 0) return <EmptyChart palette={palette} />;

  const max = Math.max(...items.map((i) => i.quantity));

  return (
    <ol className="space-y-2.5">
      {items.map((item, i) => (
        <li key={item.id} className="flex items-center gap-3">
          <span className={`w-5 shrink-0 text-xs tabular-nums ${palette.muted}`}>{i + 1}</span>
          <span className="min-w-0 flex-1">
            <span className={`block truncate text-sm ${palette.text}`}>{item.name}</span>
            <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-black/5">
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${(item.quantity / max) * 100}%`,
                  background: muted ? "rgba(0,0,0,0.18)" : palette.accent,
                }}
              />
            </span>
          </span>
          <span className={`w-10 text-right text-sm tabular-nums ${palette.text}`}>
            {item.quantity}
          </span>
          <span className={`w-20 text-right text-sm tabular-nums ${palette.muted}`}>
            {gbp.format(item.revenue)}
          </span>
        </li>
      ))}
    </ol>
  );
}

function EmptyChart({ palette }: { palette: Palette }) {
  return (
    <p className={`py-12 text-center text-sm ${palette.muted}`}>
      Nothing recorded for this period yet.
    </p>
  );
}