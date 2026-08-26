"use client";

/**
 * PUBLIC customer-facing page. Lives under (staff) only because the URL
 * segment is shared — it requires no session and the branch layout skips
 * its sidebar and auth checks for this path.
 */

import { use, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Check,
  ChefHat,
  ChevronDown,
  Clock,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Utensils,
  X,
} from "lucide-react";
import { useGuestTheme, ThemeToggle } from "@/components/guest/guest-theme";
import { effectivePrice } from "@/lib/pricing";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

type TableContext = {
  table_number: number;
  region: string | null;
  seats: number;
  branch_name: string;
  branch_slug: string;
  tenant_name: string;
  logo_url: string | null;
  currency: string;
  ask_for_name: boolean;
  allergen_notice: string | null;
  food_hygiene_rating: number | null;
  prep_minutes_min: number;
  prep_minutes_max: number;
};

type MainCategory = { id: string; name: string; sort_order: number };
type SubCategory = { id: string; main_category_id: string; name: string; sort_order: number };
type MenuItem = {
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

type OrderItem = {
  id: string;
  menu_item_id: string;
  menu_item_title: string | null;
  quantity: number;
  total_price: number;
};

type Order = {
  id: string;
  status: string;
  seat_number: number | null;
  special_request: string | null;
  total_amount: number;
  created_at: string;
  order_items: OrderItem[];
};

type Step = "details" | "review";

const PREP_MINUTES_MIN = 15;
const PREP_MINUTES_MAX = 25;

const TRACK_STEPS = [
  { key: "pending", label: "Sent", icon: Check },
  { key: "in_progress", label: "Preparing", icon: ChefHat },
  { key: "ready", label: "Ready", icon: Utensils },
];



async function publicFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? "Something went wrong.");
  }
  if (res.status === 204) return null;
  return res.json();
}

function timeRange(createdAt: string, minMinutes: number, maxMinutes: number) {
  const start = new Date(createdAt);
  const from = new Date(start.getTime() + minMinutes * 60000);
  const to = new Date(start.getTime() + maxMinutes * 60000);
  const fmt = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${fmt(from)} – ${fmt(to)}`;
}

export default function GuestOrderPage({
  params,
}: {
  params: Promise<{ branchSlug: string }>;
}) {
  use(params);
  const searchParams = useSearchParams();
  const qrToken = searchParams.get("table") ?? "";
  const { theme, toggle, ready } = useGuestTheme();

  const [context, setContext] = useState<TableContext | null>(null);
  const [mains, setMains] = useState<MainCategory[]>([]);
  const [subs, setSubs] = useState<SubCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);

  const [activeMain, setActiveMain] = useState<string | null>(null);
  const [activeSub, setActiveSub] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [cart, setCart] = useState<Record<string, number>>({});
  const [sheetStep, setSheetStep] = useState<Step | null>(null);
  const [seatNumber, setSeatNumber] = useState("");
  const [specialRequest, setSpecialRequest] = useState("");

  const [order, setOrder] = useState<Order | null>(null);
  const [trackOpen, setTrackOpen] = useState(false);
  const [addingMore, setAddingMore] = useState(false);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const storageKey = `sweet1ne_order_${qrToken}`;
  const money = useMemo(
    () =>
      new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: context?.currency ?? "GBP",
      }),
    [context?.currency]
  );

  useEffect(() => {
    if (!qrToken) {
      setError("This link is missing its table code. Please scan the QR code again.");
      setLoading(false);
      return;
    }

    Promise.all([
      publicFetch(`/public/menu/table/${qrToken}`),
      publicFetch(`/public/menu/main-categories?qr_token=${qrToken}`),
      publicFetch(`/public/menu/sub-categories?qr_token=${qrToken}`),
      publicFetch(`/public/menu/menu-items?qr_token=${qrToken}`),
    ])
      .then(([ctx, m, s, i]) => {
        setContext(ctx);
        const sorted = [...m].sort((a, b) => a.sort_order - b.sort_order);
        setMains(sorted);
        setSubs(s);
        setItems(i);
        if (sorted.length > 0) setActiveMain(sorted[0].id);
      })
      .catch(() =>
        setError("We couldn't load this menu. Please scan the code again or ask a member of staff.")
      )
      .finally(() => setLoading(false));
  }, [qrToken]);

  useEffect(() => {
    if (!qrToken) return;
    const savedId = window.localStorage.getItem(storageKey);
    if (!savedId) return;

    publicFetch(`/public/orders/${savedId}?qr_token=${qrToken}`)
      .then((found: Order) => {
        if (found.status === "cancelled") {
          window.localStorage.removeItem(storageKey);
          return;
        }
        setOrder(found);
      })
      .catch(() => window.localStorage.removeItem(storageKey));
  }, [qrToken, storageKey]);

  useEffect(() => {
    if (!order || order.status === "completed" || order.status === "cancelled") return;

    const interval = setInterval(() => {
      publicFetch(`/public/orders/${order.id}?qr_token=${qrToken}`)
        .then(setOrder)
        .catch(() => {});
    }, 20000);

    return () => clearInterval(interval);
  }, [order, qrToken]);

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

  // The same cart at list prices, so the saving can be shown.
  const cartFullTotal = cartLines.reduce((sum, [id, qty]) => {
    const item = items.find((i) => i.id === id);
    return sum + (item ? item.price * qty : 0);
  }, 0);
  const saving = cartFullTotal - cartTotal;

  function change(itemId: string, delta: number) {
    setCart((prev) => ({ ...prev, [itemId]: Math.max(0, (prev[itemId] ?? 0) + delta) }));
  }

  function openCheckout() {
    // Adding to an existing order skips the details step — seat and any
    // request belong to the original order.
    setSheetStep(addingMore ? "review" : "details");
  }

  async function placeOrder() {
    if (cartLines.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const lines = cartLines.map(([menu_item_id, quantity]) => ({ menu_item_id, quantity }));

      const placed: Order =
        order && addingMore
          ? await publicFetch(`/public/orders/${order.id}/items?qr_token=${qrToken}`, {
              method: "POST",
              body: JSON.stringify({ items: lines }),
            })
          : await publicFetch("/public/orders", {
              method: "POST",
              body: JSON.stringify({
                qr_token: qrToken,
                seat_number: seatNumber ? Number(seatNumber) : null,
                special_request: specialRequest || null,
                items: lines,
              }),
            });

      window.localStorage.setItem(storageKey, placed.id);
      setOrder(placed);
      setCart({});
      setSheetStep(null);
      setAddingMore(false);
      setSpecialRequest("");
      setTrackOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't send that order.");
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelOrder() {
    if (!order) return;
    try {
      await publicFetch(`/public/orders/${order.id}?qr_token=${qrToken}`, {
        method: "PATCH",
        body: JSON.stringify({ cancel: true }),
      });
      window.localStorage.removeItem(storageKey);
      setOrder(null);
      setTrackOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't cancel that order.");
    }
  }

  if (!ready) return null;

  const orderActive = order && order.status !== "cancelled";
  const canStillChange = order?.status === "pending";
  const currentStepIndex = TRACK_STEPS.findIndex((s) => s.key === order?.status);

  return (
    <div
      data-guest-theme={theme}
      className="min-h-screen bg-guest-bg text-guest-text transition-colors"
    >
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-guest-border bg-guest-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          {context?.logo_url ? (
            <img src={context.logo_url} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-guest-accent text-sm font-semibold text-white">
              {(context?.tenant_name ?? "S").charAt(0)}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg leading-tight">
              {context?.tenant_name ?? "Menu"}
            </p>
            {context && (
              <p className="truncate text-xs text-guest-muted">
                Table {context.table_number}
                {context.region && ` · ${context.region}`} · {context.branch_name}
              </p>
            )}
          </div>

          <ThemeToggle theme={theme} onToggle={toggle} />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-40 pt-5 sm:px-6 lg:px-8">
        {error && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-guest-accent/30 bg-guest-accent-soft px-4 py-3 text-sm"
          >
            {error}
          </div>
        )}

        <div className="lg:grid lg:grid-cols-[1fr_340px] lg:items-start lg:gap-8">
          {/* Menu column */}
          <div>
            {orderActive && (
              <div className="lg:hidden">
                <OrderTracker
                  order={order!}
                  money={money}
                  open={trackOpen}
                  onToggle={() => setTrackOpen((v) => !v)}
                  onAddMore={() => {
                    setAddingMore(true);
                    setTrackOpen(false);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  onCancel={cancelOrder}
                  canStillChange={canStillChange}
                  currentStepIndex={currentStepIndex}
                  prepMin={context?.prep_minutes_min ?? 15}
                  prepMax={context?.prep_minutes_max ?? 25}
                />
              </div>
            )}

            {addingMore && (
              <div className="mb-5 flex items-center gap-3 rounded-xl bg-guest-elevated px-4 py-3 text-sm">
                <span className="flex-1">Adding to your existing order.</span>
                <button
                  onClick={() => {
                    setAddingMore(false);
                    setCart({});
                  }}
                  aria-label="Stop adding"
                  className="text-guest-muted"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Search */}
            <div className="relative mb-4">
              <Search
                size={17}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-guest-muted"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search the menu"
                className="h-12 w-full rounded-xl border border-guest-border bg-guest-card pl-11 pr-4 text-base outline-none placeholder:text-guest-muted focus:border-guest-accent"
              />
            </div>

            {/* Categories */}
            {!query && mains.length > 0 && (
              <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
                {mains.map((main) => {
                  const active = main.id === activeMain;
                  return (
                    <button
                      key={main.id}
                      onClick={() => {
                        setActiveMain(main.id);
                        setActiveSub(null);
                      }}
                      className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${
                        active
                          ? "bg-guest-accent text-white"
                          : "border border-guest-border bg-guest-card text-guest-muted"
                      }`}
                    >
                      {main.name}
                    </button>
                  );
                })}
              </div>
            )}

            {!query && visibleSubs.length > 0 && (
              <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
                <button
                  onClick={() => setActiveSub(null)}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm ${
                    activeSub === null
                      ? "bg-guest-accent-soft text-guest-accent"
                      : "text-guest-muted"
                  }`}
                >
                  All
                </button>
                {visibleSubs.map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => setActiveSub(activeSub === sub.id ? null : sub.id)}
                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm ${
                      activeSub === sub.id
                        ? "bg-guest-accent-soft text-guest-accent"
                        : "text-guest-muted"
                    }`}
                  >
                    {sub.name}
                  </button>
                ))}
              </div>
            )}

            {/* Items */}
            {loading ? (
              <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3 rounded-2xl border border-guest-border p-3">
                    <div className="h-24 w-24 shrink-0 animate-pulse rounded-xl bg-guest-elevated" />
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-4 w-32 animate-pulse rounded bg-guest-elevated" />
                      <div className="h-3 w-full animate-pulse rounded bg-guest-elevated" />
                    </div>
                  </div>
                ))}
              </div>
            ) : visibleItems.length === 0 ? (
              <p className="py-16 text-center text-sm text-guest-muted">
                {query ? "Nothing matches that search." : "Nothing here just yet."}
              </p>
            ) : (
              <ul className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
                {visibleItems.map((item) => {
                  const qty = cart[item.id] ?? 0;
                  const discounted = item.promo_price != null;

                  return (
                    <li
                      key={item.id}
                      className={`flex gap-3 rounded-2xl border bg-guest-card p-3 ${
                        discounted ? "border-guest-accent/50" : "border-guest-border"
                      }`}
                    >
                      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-guest-elevated">
                        {item.picture && (
                          <>
                            <img
                              src={item.picture}
                              alt=""
                              aria-hidden
                              className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-lg"
                            />
                            <img
                              src={item.picture}
                              alt=""
                              className="relative h-full w-full object-contain"
                            />
                          </>
                        )}

                        {discounted && (
                          <span className="absolute left-1.5 top-1.5 rounded-full bg-guest-accent px-2 py-0.5 text-[10px] font-semibold text-white">
                            Offer
                          </span>
                        )}
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col">
                        <h3 className="font-display text-base leading-snug">{item.title}</h3>
                        {item.description && (
                          <p className="mt-1 line-clamp-2 text-sm text-guest-muted">
                            {item.description}
                          </p>
                        )}

                        {(item.promo_titles.length > 0 ||
                          item.dietary_tags.length > 0 ||
                          item.allergen_tags.length > 0) && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {item.promo_titles.map((promoTitle) => (
                              <span
                                key={promoTitle}
                                className="rounded-full bg-guest-accent px-2 py-0.5 text-[11px] font-medium text-white"
                              >
                                {promoTitle}
                              </span>
                            ))}
                            {item.dietary_tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full bg-guest-elevated px-2 py-0.5 text-[11px] text-guest-muted"
                              >
                                {tag.replace(/_/g, " ")}
                              </span>
                            ))}
                            {item.allergen_tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full bg-guest-accent-soft px-2 py-0.5 text-[11px] text-guest-accent"
                              >
                                {tag.replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="mt-auto flex items-center justify-between gap-3 pt-3">
                          {discounted ? (
                            <span className="flex items-baseline gap-2">
                              <span className="font-semibold tabular-nums text-guest-accent">
                                {money.format(item.promo_price!)}
                              </span>
                              <span className="text-xs tabular-nums text-guest-muted line-through">
                                {money.format(item.price)}
                              </span>
                            </span>
                          ) : (
                            <span className="font-semibold tabular-nums">
                              {money.format(item.price)}
                            </span>
                          )}

                          {qty > 0 ? (
                            <div className="flex items-center gap-1 rounded-full border border-guest-border p-1">
                              <button
                                onClick={() => change(item.id, -1)}
                                aria-label="Remove one"
                                className="flex h-8 w-8 items-center justify-center rounded-full text-guest-muted"
                              >
                                <Minus size={16} />
                              </button>
                              <span className="w-5 text-center text-sm font-medium tabular-nums">
                                {qty}
                              </span>
                              <button
                                onClick={() => change(item.id, 1)}
                                aria-label="Add one"
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-guest-accent text-white"
                              >
                                <Plus size={16} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => change(item.id, 1)}
                              className="rounded-full bg-guest-accent px-4 py-2 text-sm font-medium text-white"
                            >
                              Add
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Sidebar — large screens only */}
          <aside className="hidden lg:sticky lg:top-24 lg:block">
            {orderActive ? (
              <OrderTracker
                order={order!}
                money={money}
                open
                onToggle={() => {}}
                onAddMore={() => {
                  setAddingMore(true);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                onCancel={cancelOrder}
                canStillChange={canStillChange}
                currentStepIndex={currentStepIndex}
                alwaysOpen
                prepMin={context?.prep_minutes_min ?? 15}
                prepMax={context?.prep_minutes_max ?? 25}
              />
            ) : cartCount > 0 ? (
              <div className="rounded-2xl border border-guest-border bg-guest-card p-5">
                <h2 className="font-display text-lg">Your order</h2>
                <ul className="mt-4 space-y-2.5">
                  {cartLines.map(([id, qty]) => {
                    const item = items.find((i) => i.id === id);
                    if (!item) return null;
                    return (
                      <li key={id} className="flex items-center gap-3 text-sm">
                        <span className="w-6 shrink-0 tabular-nums text-guest-muted">{qty}×</span>
                        <span className="min-w-0 flex-1 truncate">{item.title}</span>
                        <span className="tabular-nums">
                          {money.format(effectivePrice(item) * qty)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-4 space-y-1 border-t border-guest-border pt-3">
                  {saving > 0 && (
                    <div className="flex items-center justify-between text-sm text-guest-accent">
                      <span>You save</span>
                      <span className="tabular-nums">{money.format(saving)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-guest-muted">Total</span>
                    <span className="font-semibold tabular-nums">{money.format(cartTotal)}</span>
                  </div>
                </div>
                <button
                  onClick={openCheckout}
                  className="mt-4 w-full rounded-xl bg-guest-accent py-3 text-sm font-semibold text-white"
                >
                  Place order
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-guest-border p-8 text-center">
                <ShoppingBag size={24} className="mx-auto text-guest-muted" />
                <p className="mt-3 text-sm text-guest-muted">
                  Tap Add on anything you fancy and it'll appear here.
                </p>
              </div>
            )}
          </aside>
        </div>
        {context?.allergen_notice && (
          <div className="mt-8 rounded-xl border border-guest-border bg-guest-elevated px-4 py-3">
            <p className="text-sm text-guest-muted">{context.allergen_notice}</p>
            {context.food_hygiene_rating != null && (
              <p className="mt-2 text-xs text-guest-muted">
                Food hygiene rating: {context.food_hygiene_rating} out of 5
              </p>
            )}
          </div>
        )}
      </main>

      {/* Cart bar — hidden on large screens, where the aside takes over */}
      {cartCount > 0 && !sheetStep && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-guest-border bg-guest-card lg:hidden">
          <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
            <span className="flex items-center gap-2 text-sm text-guest-muted">
              <ShoppingBag size={18} />
              {cartCount} item{cartCount === 1 ? "" : "s"}
            </span>
            <span className="flex-1 text-right">
              <span className="font-semibold tabular-nums">{money.format(cartTotal)}</span>
              {saving > 0 && (
                <span className="ml-2 text-xs font-medium text-guest-accent">
                  save {money.format(saving)}
                </span>
              )}
            </span>
            <button
              onClick={openCheckout}
              className="rounded-xl bg-guest-accent px-6 py-3 text-sm font-semibold text-white"
            >
              {addingMore ? "Review" : "Place order"}
            </button>
          </div>
        </div>
      )}

      {/* Checkout sheet */}
      {sheetStep && (
        <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !submitting && setSheetStep(null)}
          />

          <div className="relative max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-guest-border bg-guest-card sm:rounded-3xl">
            <div className="sticky top-0 bg-guest-card pt-3">
              <div className="mx-auto h-1 w-10 rounded-full bg-guest-border sm:hidden" />
              <div className="flex items-center justify-between px-5 py-3">
                <h2 className="font-display text-xl">
                  {sheetStep === "details" ? "A few details" : "Your order"}
                </h2>
                <button
                  onClick={() => setSheetStep(null)}
                  disabled={submitting}
                  aria-label="Close"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-guest-muted"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {sheetStep === "details" ? (
              <div className="space-y-5 px-5 pb-6">
                <p className="text-sm text-guest-muted">
                  Both of these are optional — skip straight ahead if there's nothing to add.
                </p>

                <div className="space-y-1.5">
                  <label htmlFor="seat" className="flex items-center gap-2 text-sm">
                    Which seat are you in?
                    <span className="rounded-full bg-guest-elevated px-2 py-0.5 text-[11px] text-guest-muted">
                      Optional
                    </span>
                  </label>
                  <input
                    id="seat"
                    type="number"
                    min="1"
                    max={context?.seats ?? 20}
                    value={seatNumber}
                    onChange={(e) => setSeatNumber(e.target.value)}
                    placeholder={`1–${context?.seats ?? 20}`}
                    className="h-12 w-full rounded-xl border border-guest-border bg-guest-bg px-4 text-base outline-none placeholder:text-guest-muted focus:border-guest-accent"
                  />
                  <p className="text-xs text-guest-muted">Helps us bring it to the right person.</p>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="request" className="flex items-center gap-2 text-sm">
                    Anything we should know?
                    <span className="rounded-full bg-guest-elevated px-2 py-0.5 text-[11px] text-guest-muted">
                      Optional
                    </span>
                  </label>
                  <textarea
                    id="request"
                    rows={3}
                    value={specialRequest}
                    onChange={(e) => setSpecialRequest(e.target.value)}
                    placeholder="Allergies, no onions, extra ice…"
                    className="w-full resize-none rounded-xl border border-guest-border bg-guest-bg px-4 py-3 text-base outline-none placeholder:text-guest-muted focus:border-guest-accent"
                  />
                </div>

                <button
                  onClick={() => setSheetStep("review")}
                  className="w-full rounded-xl bg-guest-accent py-4 text-base font-semibold text-white"
                >
                  Continue
                </button>
              </div>
            ) : (
              <div className="space-y-5 px-5 pb-6">
                <ul className="space-y-3">
                  {cartLines.map(([id, qty]) => {
                    const item = items.find((i) => i.id === id);
                    if (!item) return null;
                    const unit = effectivePrice(item);

                    return (
                      <li key={id} className="flex items-center gap-3">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">{item.title}</span>
                          <span className="block text-xs text-guest-muted">
                            {money.format(unit)} each
                            {item.promo_price != null && (
                              <span className="ml-1.5 line-through">
                                {money.format(item.price)}
                              </span>
                            )}
                          </span>
                        </span>

                        <div className="flex items-center gap-1 rounded-full border border-guest-border p-1">
                          <button
                            onClick={() => change(id, -1)}
                            aria-label="Remove one"
                            className="flex h-8 w-8 items-center justify-center rounded-full text-guest-muted"
                          >
                            <Minus size={15} />
                          </button>
                          <span className="w-5 text-center text-sm font-medium tabular-nums">
                            {qty}
                          </span>
                          <button
                            onClick={() => change(id, 1)}
                            aria-label="Add one"
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-guest-accent text-white"
                          >
                            <Plus size={15} />
                          </button>
                        </div>

                        <span className="w-16 text-right text-sm font-medium tabular-nums">
                          {money.format(unit * qty)}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                {!addingMore && (seatNumber || specialRequest) && (
                  <div className="space-y-1 rounded-xl bg-guest-elevated px-4 py-3 text-sm">
                    {seatNumber && (
                      <p>
                        <span className="text-guest-muted">Seat</span> {seatNumber}
                      </p>
                    )}
                    {specialRequest && (
                      <p>
                        <span className="text-guest-muted">Request</span> {specialRequest}
                      </p>
                    )}
                    <button
                      onClick={() => setSheetStep("details")}
                      className="pt-1 text-xs text-guest-accent underline underline-offset-4"
                    >
                      Change
                    </button>
                  </div>
                )}

                <div className="space-y-2 border-t border-guest-border pt-4">
                  {saving > 0 && (
                    <div className="flex items-center justify-between text-sm text-guest-accent">
                      <span>You save</span>
                      <span className="tabular-nums">{money.format(saving)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-guest-muted">Total</span>
                    <span className="font-display text-2xl tabular-nums">
                      {money.format(cartTotal)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={placeOrder}
                  disabled={submitting}
                  className="w-full rounded-xl bg-guest-accent py-4 text-base font-semibold text-white disabled:opacity-60"
                >
                  {submitting ? "Sending…" : addingMore ? "Add to order" : "Send order"}
                </button>

                <p className="text-center text-xs text-guest-muted">
                  {addingMore
                    ? "These go on the same bill."
                    : "You can change or cancel this while it's still with the kitchen."}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */

function OrderTracker({
  order,
  money,
  open,
  onToggle,
  onAddMore,
  onCancel,
  canStillChange,
  currentStepIndex,
  prepMin,
  prepMax,
  alwaysOpen = false,
}: {
  order: Order;
  money: Intl.NumberFormat;
  open: boolean;
  onToggle: () => void;
  onAddMore: () => void;
  onCancel: () => void;
  canStillChange: boolean;
  currentStepIndex: number;
  prepMin: number;
  prepMax: number;
  alwaysOpen?: boolean; 
}) {
  const done = order.status === "completed" || order.status === "ready";

  return (
    <div className="mb-5 overflow-hidden rounded-2xl border border-guest-accent/30 bg-guest-accent-soft">
      {!alwaysOpen && (
        <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-guest-accent text-white">
            {done ? <Check size={17} /> : <Clock size={17} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">
              {TRACK_STEPS[currentStepIndex]?.label ?? "Your order"}
            </span>
            <span className="block truncate text-xs text-guest-muted">
              {order.order_items.length} item{order.order_items.length === 1 ? "" : "s"} ·{" "}
              {money.format(order.total_amount)}
            </span>
          </span>
          <ChevronDown
            size={17}
            className={`shrink-0 text-guest-muted transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      )}

      {open && (
        <div
          className={`space-y-5 px-4 pb-4 ${
            alwaysOpen ? "pt-4" : "border-t border-guest-accent/20 pt-4"
          }`}
        >
          {/* Stepper */}
          <div className="flex items-center">
            {TRACK_STEPS.map((step, i) => {
              const reached = i <= currentStepIndex;
              const Icon = step.icon;
              return (
                <div key={step.key} className="flex flex-1 items-center last:flex-none">
                  <div className="flex flex-col items-center gap-1.5">
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
                        reached
                          ? "bg-guest-accent text-white"
                          : "border border-guest-border bg-guest-card text-guest-muted"
                      }`}
                    >
                      <Icon size={16} />
                    </span>
                    <span
                      className={`text-[11px] ${reached ? "text-guest-text" : "text-guest-muted"}`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {i < TRACK_STEPS.length - 1 && (
                    <span
                      className={`mx-1 mb-5 h-0.5 flex-1 rounded-full ${
                        i < currentStepIndex ? "bg-guest-accent" : "bg-guest-border"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Estimate */}
          {!done && (
            <div className="flex items-center gap-2.5 rounded-xl bg-guest-card px-4 py-3">
              <Clock size={16} className="shrink-0 text-guest-accent" />
              <span className="text-sm">
                <span className="text-guest-muted">Expected around</span>{" "}
                <span className="font-medium">{timeRange(order.created_at, prepMin, prepMax)}</span>
              </span>
            </div>
          )}

          {/* Items */}
          <ul className="space-y-2">
            {order.order_items.map((line) => (
              <li key={line.id} className="flex items-center gap-3 text-sm">
                <span className="w-6 shrink-0 tabular-nums text-guest-muted">
                  {line.quantity}×
                </span>
                <span className="min-w-0 flex-1 truncate">{line.menu_item_title ?? "Item"}</span>
                <span className="tabular-nums">{money.format(line.total_price)}</span>
              </li>
            ))}
          </ul>

          {order.special_request && (
            <p className="rounded-lg bg-guest-card px-3 py-2 text-sm text-guest-muted">
              {order.special_request}
            </p>
          )}

          <div className="flex items-center justify-between border-t border-guest-accent/20 pt-3">
            <span className="text-sm text-guest-muted">Total</span>
            <span className="font-semibold tabular-nums">{money.format(order.total_amount)}</span>
          </div>

          {order.status !== "completed" && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={onAddMore}
                className="flex-1 rounded-xl bg-guest-accent px-4 py-2.5 text-sm font-medium text-white"
              >
                Order more
              </button>
              {canStillChange && (
                <button
                  onClick={onCancel}
                  className="rounded-xl border border-guest-border bg-guest-card px-4 py-2.5 text-sm text-guest-muted"
                >
                  Cancel
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}