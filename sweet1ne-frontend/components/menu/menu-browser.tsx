"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X, Minus, Plus } from "lucide-react";
import { effectivePrice } from "@/lib/pricing";

export type MainCategory = {
  id: string;
  name: string;
  sort_order: number;
  branch_id: string | null;
  prep_station: string;
  // The course "medal" — decorative chrome on the admin menu board's filter
  // pill and chapter header. Never required.
  picture: string | null;
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
  pictures: string[];
  is_available: boolean;
  dietary_tags: string[];
  allergen_tags: string[];
  /** None means "use this dish's category station" (MainCategory.prep_station)
   *  — set only when this specific dish fires at the other station. */
  prep_station_override: string | null;
  /** Set when an active promotion applies — this is what will be charged. */
  promo_price: number | null;
  promo_titles: string[];
};

export type CartLine = { menu_item_id: string; quantity: number };

/** A dish's own override wins when set; otherwise its category's station —
 *  the same fallback the real Kitchen/Bar KDS routing uses server-side. */
export function resolveStation(
  item: MenuItem,
  mains: MainCategory[],
  subs: SubCategory[],
): "kitchen" | "bar" {
  if (item.prep_station_override === "kitchen" || item.prep_station_override === "bar") {
    return item.prep_station_override;
  }
  const sub = subs.find((s) => s.id === item.sub_category_id);
  const main = sub ? mains.find((m) => m.id === sub.main_category_id) : undefined;
  return main?.prep_station === "bar" ? "bar" : "kitchen";
}

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

const hairline = "border-[rgba(229,226,225,0.08)]";

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
      <div className="space-y-6" aria-busy="true">
        <div className="h-8 w-2/3 animate-pulse bg-white/5" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-5 w-1/2 animate-pulse bg-white/5" />
            <div className="h-3 w-4/5 animate-pulse bg-white/[0.03]" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-7 text-[var(--ivory)]">
      {error && (
        <p role="alert" className="border-l-2 border-[#ffb4ab] pl-3 text-sm text-[#ffb4ab]">
          {error}
        </p>
      )}

      {headerSlot}

      <div className="relative">
        <Search
          size={16}
          strokeWidth={1.5}
          className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-[var(--gold)]"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the menu"
          className="w-full border-0 border-b border-[var(--gold-line)] bg-transparent pb-2.5 pl-7 pt-1 text-base text-[var(--ivory)] outline-none transition-colors placeholder:text-[var(--ivory-dim)] focus:border-[var(--gold)]"
        />
      </div>

      {!query && (
        <nav
          aria-label="Courses"
          className={`no-scrollbar -mb-2 flex gap-7 overflow-x-auto border-b ${hairline}`}
        >
          {mains.map((main) => {
            const active = main.id === activeMain;
            return (
              <button
                key={main.id}
                type="button"
                onClick={() => {
                  setActiveMain(main.id);
                  setActiveSub(null);
                }}
                className={`-mb-px shrink-0 border-b-2 pb-3 font-display text-xl transition-colors sm:text-2xl ${
                  active
                    ? "border-[var(--gold)] text-[var(--gold)]"
                    : "border-transparent text-[var(--ivory-dim)] hover:text-[var(--ivory)]"
                }`}
              >
                {main.name}
              </button>
            );
          })}
        </nav>
      )}

      {!query && visibleSubs.length > 0 && (
        <div className="no-scrollbar flex gap-5 overflow-x-auto text-[0.7rem] uppercase tracking-[0.18em]">
          {[{ id: null as string | null, name: "All" }, ...visibleSubs].map((sub) => {
            const active = activeSub === sub.id;
            return (
              <button
                key={sub.id ?? "all"}
                type="button"
                onClick={() => setActiveSub(sub.id === null ? null : activeSub === sub.id ? null : sub.id)}
                className={`shrink-0 border-b pb-1 transition-colors ${
                  active
                    ? "border-[var(--gold)] text-[var(--gold)]"
                    : "border-transparent text-[var(--ivory-dim)] hover:text-[var(--ivory)]"
                }`}
              >
                {sub.name}
              </button>
            );
          })}
        </div>
      )}

      {visibleItems.length === 0 ? (
        <p className="py-14 text-center font-display text-lg italic text-[var(--ivory-dim)]">
          {query ? "Nothing matches that search." : "Nothing on the menu here yet."}
        </p>
      ) : (
        <ul className={compact ? "" : "lg:columns-2 lg:gap-x-14"}>
          {visibleItems.map((item) => {
            const qty = cart[item.id] ?? 0;
            const discounted = item.promo_price != null;

            return (
              <li key={item.id} className={`break-inside-avoid border-b py-5 ${hairline}`}>
                <div className="flex gap-4">
                  {item.picture && (
                    <img
                      src={item.picture}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-full object-cover ring-1 ring-[var(--gold-line)]"
                    />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-3">
                      <h3 className="font-display text-lg leading-tight">{item.title}</h3>
                      <span
                        aria-hidden
                        className="min-w-4 flex-1 translate-y-[-0.3rem] border-b border-dotted border-[var(--gold-line)]"
                      />
                      <span className="flex shrink-0 items-baseline gap-2">
                        {discounted && (
                          <span className="text-sm tabular-nums text-[var(--ivory-dim)] line-through">
                            {gbp.format(item.price)}
                          </span>
                        )}
                        <span className="font-display text-lg tabular-nums text-[var(--gold)]">
                          {gbp.format(discounted ? item.promo_price! : item.price)}
                        </span>
                      </span>
                    </div>

                    {item.description && (
                      <p className="mt-1.5 text-sm italic leading-relaxed text-[var(--ivory-dim)]">
                        {item.description}
                      </p>
                    )}

                    {(item.promo_titles.length > 0 ||
                      item.dietary_tags.length > 0 ||
                      item.allergen_tags.length > 0) && (
                      <p className="mt-2 text-[0.66rem] uppercase leading-relaxed tracking-[0.16em]">
                        {item.promo_titles.length > 0 && (
                          <span className="font-semibold text-[var(--gold)]">
                            {item.promo_titles.join(" · ")}
                          </span>
                        )}
                        {item.dietary_tags.length > 0 && (
                          <span className="ml-3 text-[var(--gold)]/80">
                            {item.dietary_tags.map((t) => t.replace(/_/g, " ")).join(" · ")}
                          </span>
                        )}
                        {item.allergen_tags.length > 0 && (
                          <span className="ml-3 text-[var(--ivory-dim)]">
                            Contains {item.allergen_tags.map((t) => t.replace(/_/g, " ")).join(", ")}
                          </span>
                        )}
                      </p>
                    )}

                    {ordering && (
                      <div className="mt-3 flex justify-end">
                        {qty > 0 ? (
                          <div className="flex items-center gap-4 text-[var(--gold)]">
                            <button
                              type="button"
                              onClick={() => change(item.id, -1)}
                              aria-label="Remove one"
                              className="grid h-8 w-8 place-items-center border border-[var(--gold-line)] transition-colors hover:border-[var(--gold)]"
                            >
                              <Minus size={14} />
                            </button>
                            <span className="w-5 text-center font-display text-lg tabular-nums text-[var(--ivory)]">
                              {qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => change(item.id, 1)}
                              aria-label="Add one"
                              className="grid h-8 w-8 place-items-center border border-[var(--gold-line)] transition-colors hover:border-[var(--gold)]"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => change(item.id, 1)}
                            className="border border-[var(--gold)] px-5 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--gold)] transition-colors hover:bg-[var(--gold)] hover:text-[#0e0e0e]"
                          >
                            Add
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {ordering && cartCount > 0 && (
        <div className="sticky bottom-0 -mx-1 border-t border-[var(--gold)] bg-[#0a0a0a] px-4 py-4 shadow-[0_-18px_30px_rgba(0,0,0,0.55)]">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setCartOpen((v) => !v)}
              className="text-[0.7rem] uppercase tracking-[0.18em] text-[var(--ivory-dim)] transition-colors hover:text-[var(--gold)]"
            >
              {cartCount} item{cartCount === 1 ? "" : "s"} {cartOpen ? "−" : "+"}
            </button>

            <span className="flex-1 text-right">
              <span className="font-display text-xl tabular-nums text-[var(--gold)]">
                {gbp.format(cartTotal)}
              </span>
              {saving > 0 && (
                <span className="ml-2 text-[0.68rem] uppercase tracking-[0.14em] text-[var(--gold)]/80">
                  saving {gbp.format(saving)}
                </span>
              )}
            </span>

            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="bg-[var(--gold)] px-6 py-2.5 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#0e0e0e] transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? "Sending…" : submitLabel}
            </button>
          </div>

          {cartOpen && (
            <ul className={`mt-4 space-y-2.5 border-t pt-4 ${hairline} ${compact ? "max-h-40 overflow-y-auto" : ""}`}>
              {cartLines.map(([id, qty]) => {
                const item = items.find((i) => i.id === id);
                if (!item) return null;
                const lineTotal = effectivePrice(item) * qty;

                return (
                  <li key={id} className="flex items-center gap-3 text-sm">
                    <span className="flex-1 truncate">
                      {item.title}
                      {item.promo_price != null && (
                        <span className="ml-2 text-[0.62rem] uppercase tracking-[0.14em] text-[var(--gold)]">offer</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => change(id, -1)}
                      aria-label="Remove one"
                      className="grid h-6 w-6 place-items-center text-[var(--gold)] hover:bg-white/5"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="w-4 text-center tabular-nums">{qty}</span>
                    <button
                      type="button"
                      onClick={() => change(id, 1)}
                      aria-label="Add one"
                      className="grid h-6 w-6 place-items-center text-[var(--gold)] hover:bg-white/5"
                    >
                      <Plus size={13} />
                    </button>
                    <span className="w-16 text-right tabular-nums text-[var(--ivory-dim)]">
                      {gbp.format(lineTotal)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCart((prev) => ({ ...prev, [id]: 0 }))}
                      aria-label="Remove item"
                      className="text-[var(--ivory-dim)] hover:text-[#ffb4ab]"
                    >
                      <X size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
