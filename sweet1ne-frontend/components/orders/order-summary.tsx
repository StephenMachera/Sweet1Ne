"use client";

import { Banknote, ReceiptText, TrendingUp } from "lucide-react";

type Order = {
  status: string;
  total_amount: number;
  order_items: { menu_item_title: string | null; quantity: number }[];
};

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const gbpPrecise = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

export function OrderSummary({
  orders,
  tone,
}: {
  orders: Order[];
  tone: "admin" | "branch";
}) {
  const isBranch = tone === "branch";

  const card = isBranch
    ? "border-slate-bg bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
    : "border-ink/8 bg-white shadow-[0_1px_3px_rgba(20,24,28,0.04)]";
  const text = isBranch ? "text-navy" : "text-ink";
  const muted = isBranch ? "text-slate-muted" : "text-ink-muted";

  const tones = isBranch
    ? { orders: "bg-info-bg text-info", revenue: "bg-success-bg text-success", avg: "bg-purple-bg text-purple" }
    : { orders: "bg-teal-soft text-teal", revenue: "bg-sage-soft text-sage", avg: "bg-violet-soft text-violet" };

  // Cancelled orders shouldn't inflate revenue.
  const counted = orders.filter((o) => o.status !== "cancelled");
  const revenue = counted.reduce((sum, o) => sum + o.total_amount, 0);
  const average = counted.length > 0 ? revenue / counted.length : 0;

  // Top sellers across whatever's currently in view.
  const tally = new Map<string, number>();
  for (const order of counted) {
    for (const line of order.order_items) {
      const name = line.menu_item_title ?? "Item";
      tally.set(name, (tally.get(name) ?? 0) + line.quantity);
    }
  }
  const top = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const max = top[0]?.[1] ?? 1;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      {/* Figures */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Figure
          icon={ReceiptText}
          label="Orders"
          value={String(counted.length)}
          tone={tones.orders}
          card={card}
          text={text}
          muted={muted}
        />
        <Figure
          icon={Banknote}
          label="Revenue"
          value={gbp.format(revenue)}
          tone={tones.revenue}
          card={card}
          text={text}
          muted={muted}
        />
        <Figure
          icon={TrendingUp}
          label="Average"
          value={gbpPrecise.format(average)}
          tone={tones.avg}
          card={card}
          text={text}
          muted={muted}
        />
      </div>

      {/* Top sellers */}
      <div className={`rounded-xl border p-4 ${card}`}>
        <p className={`text-[11px] uppercase tracking-[0.14em] ${muted}`}>Top sellers</p>

        {top.length === 0 ? (
          <p className={`py-4 text-center text-sm ${muted}`}>Nothing sold in this period.</p>
        ) : (
          <ol className="mt-3 space-y-2">
            {top.map(([name, qty], i) => (
              <li key={name} className="flex items-center gap-3">
                <span className={`w-4 shrink-0 text-xs tabular-nums ${muted}`}>{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm ${text}`}>{name}</span>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-black/5">
                    <span
                      className={`block h-full rounded-full ${isBranch ? "bg-emerald" : "bg-gold"}`}
                      style={{ width: `${(qty / max) * 100}%` }}
                    />
                  </span>
                </span>
                <span className={`w-8 text-right text-sm tabular-nums ${text}`}>{qty}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function Figure({
  icon: Icon,
  label,
  value,
  tone,
  card,
  text,
  muted,
}: {
  icon: any;
  label: string;
  value: string;
  tone: string;
  card: string;
  text: string;
  muted: string;
}) {
  return (
    <div className={`rounded-xl border p-4 ${card}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`text-[11px] uppercase tracking-[0.14em] ${muted}`}>{label}</p>
          <p className={`mt-1.5 text-2xl font-semibold tabular-nums ${text}`}>{value}</p>
        </div>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}>
          <Icon size={15} />
        </span>
      </div>
    </div>
  );
}