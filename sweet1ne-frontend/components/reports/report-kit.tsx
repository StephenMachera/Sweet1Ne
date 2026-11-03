"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
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

// ───────────────────────── data ─────────────────────────

/** Loads a URL and only ever sets state from the response callback, so a
 * range or branch change shows the previous numbers until the new ones land
 * rather than flashing empty. */
export function useJson<T>(url: string | null) {
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

export type Res<T> = { data: T | null; loading: boolean; failed: boolean };

export function hourLabel(hour: number): string {
  const h = hour % 24;
  return `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;
}

export const HOURS = Array.from({ length: 24 }, (_, h) => hourLabel(h));
export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// ───────────────────────── charts ─────────────────────────

// Validated against the admin's dark surface (see the Email activity tab):
// #c9a24a for the main series, #3987e5 for a second one.
export const GOLD = "#c9a24a";
export const BLUE = "#3987e5";
export const INK = "#e5e2e1";
export const MUTED = "rgba(229, 226, 225, 0.58)";
export const GRID = "rgba(229, 226, 225, 0.08)";

/** Mounts its children only once scrolled into view, so a chart further
 * down the page plays its grow-in animation when the reader gets to it
 * instead of finishing off-screen. */
export function Reveal({ height, children }: { height: number; children: ReactNode }) {
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

export function BarChart({
  labels,
  values,
  color = GOLD,
  horizontal = false,
  height = 220,
  label,
  compare,
  sparseLabels = false,
  money = false,
  overlay = false,
  names,
}: {
  labels: string[];
  values: number[];
  color?: string;
  horizontal?: boolean;
  height?: number;
  label: string;
  compare?: { values: number[]; color: string };
  sparseLabels?: boolean;
  money?: boolean;
  overlay?: boolean;
  names?: [string, string];
}) {
  const fmt = (n: number) => (money ? `£${Math.round(n).toLocaleString("en-GB")}` : String(n));
  const valueTicks = {
    color: MUTED,
    font: { size: 11 },
    precision: 0,
    callback: (v: string | number) => fmt(Number(v)),
  };
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
        callbacks: {
          label: (ctx) => `${ctx.dataset.label ? `${ctx.dataset.label}: ` : ""}${fmt(Number(ctx.parsed[horizontal ? "x" : "y"]))}`,
        },
      },
    },
    scales: {
      x: {
        beginAtZero: horizontal,
        grid: { color: horizontal ? GRID : "transparent" },
        ticks: horizontal
          ? valueTicks
          : { color: MUTED, font: { size: 11 }, maxRotation: 0, autoSkip: sparseLabels, maxTicksLimit: sparseLabels ? 8 : undefined },
        border: { color: GRID },
      },
      y: {
        beginAtZero: true,
        grid: { color: horizontal ? "transparent" : GRID },
        ticks: horizontal ? { color: MUTED, font: { size: 11 } } : valueTicks,
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
            datasets: overlay && compare
              ? [
                  { label: names?.[1], data: compare.values, backgroundColor: compare.color, borderRadius: 3, grouped: false, barPercentage: 0.95, categoryPercentage: 0.95 },
                  { label: names?.[0], data: values, backgroundColor: color, borderRadius: 3, grouped: false, barPercentage: 0.55, categoryPercentage: 0.95 },
                ]
              : [
                  { label: names?.[0], data: values, backgroundColor: color, borderRadius: 3, maxBarThickness: 44 },
                  ...(compare
                    ? [{ label: names?.[1], data: compare.values, backgroundColor: compare.color, borderRadius: 3, maxBarThickness: 44 }]
                    : []),
                ],
          }}
        />
      </div>
    </Reveal>
  );
}

// ───────────────────────── small pieces ─────────────────────────

export function Tag({ children }: { children: ReactNode }) {
  return <span className="rg-tag">{children}</span>;
}

export function Panel({
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

export function Table({ head, rows, right = [] }: { head: string[]; rows: ReactNode[][]; right?: number[] }) {
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

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rg-empty">{children}</p>;
}

export function shortDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

/** One card's own loading, error and empty states, so a single failing
 * endpoint never blanks the rest of the tab. */
export function Body<T>({
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

export function NotTracked({ title, dek, tag = "Not tracked yet", wide }: { title: string; dek?: string; tag?: string; wide?: boolean }) {
  return (
    <Panel sample wide={wide} title={title} dek={dek} tag={tag}>
      <Empty>Nothing records this yet, so there is no figure to show. It is not zero.</Empty>
    </Panel>
  );
}

export function kpiNote<T>(res: Res<T>, text: (data: T) => string): string {
  if (res.failed) return "Couldn't load";
  return res.data ? text(res.data) : "Loading…";
}

