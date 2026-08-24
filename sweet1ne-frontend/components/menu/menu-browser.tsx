"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, ShoppingCart, X, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type MainCategory = {
  id: string;
  name: string;
  sort_order: number;
  branch_id: string | null;
  prep_station: string;
};

export type SubCategory = {
  id: string;
  main_category_id: string;
  name: string;
  sort_order: number;
};

export type MenuItem = {
  id: string;
  sub_category_id: string;
  title: string;
  description: string | null;
  price: number;
  picture: string | null;
  is_available: boolean;
  dietary_tags: string[];
  allergen_tags: string[];
  /** Set when an active promotion applies — this is what will be charged. */
  promo_price: number | null;
  promo_titles: string[];
};

export type CartLine = { menu_item_id: string; quantity: number };

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

/** What an item actually costs right now — the promo price if there is one. */
function effectivePrice(item: MenuItem) {
  return item.promo_price ?? item.price;
}

export function MenuBrowser({
  mode,
  fetcher,
  onSubmitOrder,
  submitLabel = "Send order",
  headerSlot,
  compact = false,
}: {
  mode: "ordering" | "preview";
  fetcher: (path: string) => Promise<any>;
  onSubmitOrder?: (lines: CartLine[]) => Promise<void>;
  submitLabel?: string;
  headerSlot?: React.ReactNode;
  compact?: boolean;
}) {
  const [mains, setMains] = useState<MainCategory[]>([]);
  const [subs, setSubs] = useState<SubCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [activeMain, setActiveMain] = useState<string | null>(null);
  const [activeSub, setActiveSub] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ordering = mode === "ordering";

  useEffect(() => {
    Promise.all([
      fetcher("/main-categories"),
      fetcher("/sub-categories"),
      fetcher("/menu-items"),
    ])
      .then(([m, s, i]) => {
        const sortedMains = [...m].sort((a, b) => a.sort_order - b.sort_order);
        setMains(sortedMains);
        setSubs(s);
        setItems(i);
        if (sortedMains.length > 0) setActiveMain(sortedMains[0].id);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [fetcher]);

  const visibleSubs = useMemo(
    () =>
      subs
        .filter((s) => s.main_category_id === activeMain)
        .sort((a, b) => a.sort_order - b.sort_order),
    [subs, activeMain]
  );

  const visibleItems = useMemo(() => {
    const subIds = new Set(visibleSubs.map((s) => s.id));
    return items.filter((item) => {
      if (!item.is_available) return false;
      if (query) {
        const q = query.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          (item.description ?? "").toLowerCase().includes(q)
        );
      }
      if (activeSub) return item.sub_category_id === activeSub;
      return subIds.has(item.sub_category_id);
    });
  }, [items, visibleSubs, activeSub, query]);

  const cartLines = Object.entries(cart).filter(([, qty]) => qty > 0);
  const cartCount = cartLines.reduce((sum, [, qty]) => sum + qty, 0);
  const cartTotal = cartLines.reduce((sum, [id, qty]) => {
    const item = items.find((i) => i.id === id);
    return sum + (item ? effectivePrice(item) * qty : 0);
  }, 0);

  // What the same cart would cost at list prices — used to show the saving.
  const cartFullTotal = cartLines.reduce((sum, [id, qty]) => {
    const item = items.find((i) => i.id === id);
    return sum + (item ? item.price * qty : 0);
  }, 0);
  const saving = cartFullTotal - cartTotal;

  function change(itemId: string, delta: number) {
    setCart((prev) => {
      const next = Math.max(0, (prev[itemId] ?? 0) + delta);
      return { ...prev, [itemId]: next };
    });
  }

  async function submit() {
    if (!onSubmitOrder || cartLines.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmitOrder(
        cartLines.map(([menu_item_id, quantity]) => ({ menu_item_id, quantity }))
      );
      setCart({});
      setCartOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the order.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className={`grid gap-4 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-slate-bg bg-white">
            <div className="h-40 animate-pulse bg-slate-bg" />
            <div className="space-y-2 p-4">
              <div className="h-4 w-32 animate-pulse rounded bg-slate-bg" />
              <div className="h-3 w-full animate-pulse rounded bg-slate-bg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`space-y-5 ${compact ? "" : "pb-24"}`}>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-danger/20 bg-danger-bg px-4 py-3 text-sm text-danger"
        >
          {error}
        </div>
      )}

      {headerSlot}

      {/* Search */}
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-muted"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the menu…"
          className="h-11 border-slate-border bg-white pl-9 text-base"
        />
      </div>

      {/* Main categories */}
      {!query && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {mains.map((main) => {
            const active = main.id === activeMain;
            return (
              <button
                key={main.id}
                onClick={() => {
                  setActiveMain(main.id);
                  setActiveSub(null);
                }}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-gradient-to-br from-emerald to-emerald-dark text-white shadow-sm"
                    : "border border-slate-border bg-white text-slate-subtle hover:text-navy"
                }`}
              >
                {main.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Sub categories */}
      {!query && visibleSubs.length > 0 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <button
            onClick={() => setActiveSub(null)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm transition-colors ${
              activeSub === null
                ? "bg-emerald/15 text-emerald-dark"
                : "bg-white text-slate-muted hover:text-navy"
            }`}
          >
            All
          </button>
          {visibleSubs.map((sub) => (
            <button
              key={sub.id}
              onClick={() => setActiveSub(activeSub === sub.id ? null : sub.id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                activeSub === sub.id
                  ? "bg-emerald/15 text-emerald-dark"
                  : "bg-white text-slate-muted hover:text-navy"
              }`}
            >
              {sub.name}
            </button>
          ))}
        </div>
      )}

      {/* Items */}
      {visibleItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-border bg-white/50 px-6 py-16 text-center">
          <p className="text-sm text-slate-muted">
            {query ? "Nothing matches that search." : "Nothing on the menu here yet."}
          </p>
        </div>
      ) : (
        <div
          className={`grid gap-4 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}
        >
          {visibleItems.map((item) => {
            const qty = cart[item.id] ?? 0;
            const discounted = item.promo_price != null;

            return (
              <div
                key={item.id}
                className={`flex flex-col overflow-hidden rounded-xl border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] ${
                  discounted ? "border-danger/30" : "border-slate-bg"
                }`}
              >
                <div
                  className={`relative flex items-center justify-center overflow-hidden bg-slate-bg ${
                    compact ? "h-32" : "h-40"
                  }`}
                >
                  {item.picture ? (
                    <>
                      <img
                        src={item.picture}
                        alt=""
                        aria-hidden
                        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-xl"
                      />
                      <img
                        src={item.picture}
                        alt=""
                        className="relative max-h-full max-w-full object-contain"
                      />
                    </>
                  ) : (
                    <span className="text-xs uppercase tracking-[0.14em] text-slate-muted">
                      No photo
                    </span>
                  )}

                  {discounted && (
                    <span className="absolute left-2 top-2 rounded-full bg-danger px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
                      Offer
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-medium text-navy">{item.title}</h3>

                    {discounted ? (
                      <span className="flex shrink-0 flex-col items-end">
                        <span className="font-semibold tabular-nums text-danger">
                          {gbp.format(item.promo_price!)}
                        </span>
                        <span className="text-xs tabular-nums text-slate-muted line-through">
                          {gbp.format(item.price)}
                        </span>
                      </span>
                    ) : (
                      <span className="shrink-0 font-semibold tabular-nums text-navy">
                        {gbp.format(item.price)}
                      </span>
                    )}
                  </div>

                  {item.description && (
                    <p className="mt-1.5 line-clamp-2 text-sm text-slate-subtle">
                      {item.description}
                    </p>
                  )}

                  {(item.promo_titles.length > 0 ||
                    item.dietary_tags.length > 0 ||
                    item.allergen_tags.length > 0) && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {item.promo_titles.map((promoTitle) => (
                        <span
                          key={promoTitle}
                          className="rounded-full bg-danger-bg px-2 py-0.5 text-[11px] font-medium text-danger"
                        >
                          {promoTitle}
                        </span>
                      ))}
                      {item.dietary_tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-success-bg px-2 py-0.5 text-[11px] text-success"
                        >
                          {tag.replace(/_/g, " ")}
                        </span>
                      ))}
                      {item.allergen_tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-warning-bg px-2 py-0.5 text-[11px] text-warning"
                        >
                          {tag.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  )}

                  {ordering && (
                    <div className="mt-4 flex items-center justify-end gap-2 pt-1">
                      {qty > 0 ? (
                        <div className="flex items-center gap-3 rounded-lg border border-slate-border px-2 py-1">
                          <button
                            onClick={() => change(item.id, -1)}
                            aria-label="Remove one"
                            className="flex h-7 w-7 items-center justify-center rounded text-slate-subtle hover:bg-slate-bg"
                          >
                            <Minus size={15} />
                          </button>
                          <span className="w-4 text-center text-sm font-medium tabular-nums text-navy">
                            {qty}
                          </span>
                          <button
                            onClick={() => change(item.id, 1)}
                            aria-label="Add one"
                            className="flex h-7 w-7 items-center justify-center rounded text-emerald-dark hover:bg-emerald/10"
                          >
                            <Plus size={15} />
                          </button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => change(item.id, 1)}
                          className="bg-gradient-to-br from-emerald to-emerald-dark text-white hover:opacity-90"
                        >
                          Add
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cart bar */}
      {ordering && cartCount > 0 && (
        <div
          className={
            compact
              ? "sticky bottom-0 mt-4 rounded-t-xl border-t border-slate-border bg-white px-3 py-3 shadow-[0_-2px_10px_rgba(0,0,0,0.06)]"
              : "fixed inset-x-0 bottom-0 z-30 border-t border-slate-border bg-white px-4 py-3 shadow-[0_-2px_10px_rgba(0,0,0,0.06)]"
          }
        >
          <div className={`flex items-center gap-3 ${compact ? "" : "mx-auto max-w-3xl"}`}>
            <button
              onClick={() => setCartOpen((v) => !v)}
              className="flex items-center gap-2 text-sm text-slate-subtle hover:text-navy"
            >
              <ShoppingCart size={18} />
              {cartCount} item{cartCount === 1 ? "" : "s"}
            </button>

            <span className="flex-1 text-right">
              <span className="font-semibold tabular-nums text-navy">
                {gbp.format(cartTotal)}
              </span>
              {saving > 0 && (
                <span className="ml-2 text-xs font-medium text-danger">
                  saving {gbp.format(saving)}
                </span>
              )}
            </span>

            <Button
              onClick={submit}
              disabled={submitting}
              className="bg-gradient-to-br from-emerald to-emerald-dark text-white hover:opacity-90"
            >
              {submitting ? "Sending…" : submitLabel}
            </Button>
          </div>

          {cartOpen && (
            <div
              className={`mt-3 space-y-2 border-t border-slate-bg pt-3 ${
                compact ? "max-h-40 overflow-y-auto" : "mx-auto max-w-3xl"
              }`}
            >
              {cartLines.map(([id, qty]) => {
                const item = items.find((i) => i.id === id);
                if (!item) return null;
                const lineTotal = effectivePrice(item) * qty;

                return (
                  <div key={id} className="flex items-center gap-3 text-sm">
                    <span className="flex-1 truncate text-body">
                      {item.title}
                      {item.promo_price != null && (
                        <span className="ml-1.5 text-[11px] text-danger">offer</span>
                      )}
                    </span>
                    <button
                      onClick={() => change(id, -1)}
                      className="flex h-6 w-6 items-center justify-center rounded text-slate-muted hover:bg-slate-bg"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="w-4 text-center tabular-nums text-navy">{qty}</span>
                    <button
                      onClick={() => change(id, 1)}
                      className="flex h-6 w-6 items-center justify-center rounded text-emerald-dark hover:bg-emerald/10"
                    >
                      <Plus size={13} />
                    </button>
                    <span className="w-16 text-right tabular-nums text-navy">
                      {gbp.format(lineTotal)}
                    </span>
                    <button
                      onClick={() => setCart((prev) => ({ ...prev, [id]: 0 }))}
                      className="text-slate-muted hover:text-danger"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}