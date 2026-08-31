"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ArrowLeft, Check, Clock, MapPin, Minus, Plus, ShoppingBag, X } from "lucide-react";
import { trackConversion } from "./analytics";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;
const STORAGE_KEY = "sweet1ne_collection_order";

type Branch = {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  phone: string | null;
  opening_time: string | null;
  closing_time: string | null;
};

type Category = { id: string; name: string; parent_id: string | null };

type Item = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  promo_price: number | null;
  promo_titles: string[];
  picture: string | null;
  main_category_id: string;
  sub_category_id: string;
};

type Step = "branch" | "menu" | "details" | "done";

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

function effectivePrice(item: Item) {
  return item.promo_price ?? item.price;
}

/**
 * Collection times in fifteen-minute steps, starting twenty minutes from now
 * — nothing is ready sooner than that — and stopping at closing.
 */
function collectionSlots(closingTime: string | null): string[] {
  const slots: string[] = [];
  const now = new Date();

  const start = new Date(now.getTime() + 20 * 60000);
  // Round up to the next quarter hour.
  start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0);

  const end = new Date(now);
  if (closingTime) {
    const [h, m] = closingTime.split(":").map(Number);
    end.setHours(h, m, 0, 0);
    // The kitchen stops before the venue does — half an hour is a fair guess
    // until it's configurable.
    end.setTime(end.getTime() - 30 * 60000);
  } else {
    end.setHours(22, 0, 0, 0);
  }

  const cursor = new Date(start);
  while (cursor <= end && slots.length < 40) {
    slots.push(
      cursor.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    );
    cursor.setMinutes(cursor.getMinutes() + 15);
  }

  return slots;
}

export function TakeawayFlow({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<Step>("branch");

  const [branches, setBranches] = useState<Branch[]>([]);
  const [branch, setBranch] = useState<Branch | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [activeMain, setActiveMain] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartOpen, setCartOpen] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [collectionTime, setCollectionTime] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<{ id: string; total: number } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/public/site/locations`).then((r) => r.json()),
      fetch(`${API_URL}/public/site/menu`).then((r) => r.json()),
    ])
      .then(([branchList, menu]) => {
        setBranches(branchList);
        setCategories(menu.categories);
        setItems(menu.items);

        const mains = menu.categories.filter((c: Category) => c.parent_id === null);
        if (mains.length > 0) setActiveMain(mains[0].id);
      })
      .catch(() => setError("We couldn't load the menu. Try again in a moment."))
      .finally(() => setLoading(false));
  }, []);

  const mains = useMemo(
    () => categories.filter((c) => c.parent_id === null),
    [categories]
  );

  const visibleItems = useMemo(
    () => items.filter((item) => !activeMain || item.main_category_id === activeMain),
    [items, activeMain]
  );

  const cartLines = Object.entries(cart).filter(([, qty]) => qty > 0);
  const cartCount = cartLines.reduce((sum, [, qty]) => sum + qty, 0);
  const cartTotal = cartLines.reduce((sum, [id, qty]) => {
    const item = items.find((i) => i.id === id);
    return sum + (item ? effectivePrice(item) * qty : 0);
  }, 0);

  const slots = useMemo(
    () => (branch ? collectionSlots(branch.closing_time) : []),
    [branch]
  );

  function change(itemId: string, delta: number) {
    setCart((prev) => ({ ...prev, [itemId]: Math.max(0, (prev[itemId] ?? 0) + delta) }));
  }

  async function submit() {
    if (!branch || cartLines.length === 0) return;

    if (!collectionTime) {
      setError("Please choose a collection time.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/public/site/collection-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch_id: branch.id,
          customer_name: name,
          customer_phone: phone,
          collection_time: collectionTime,
          notes: notes || null,
          items: cartLines.map(([menu_item_id, quantity]) => ({
            menu_item_id,
            quantity,
          })),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? "Something went wrong.");
      }

      const order = await res.json();

      // Kept so they can check on it after closing the tab.
      window.localStorage.setItem(STORAGE_KEY, order.id);

      trackConversion("Purchase", { value: cartTotal, currency: "GBP" });

      setPlaced({ id: order.id, total: order.total_amount });
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't place that order.");
    } finally {
      setSubmitting(false);
    }
  }

  // --- Done ------------------------------------------------------------

  if (step === "done" && placed) {
    return (
      <section className="relative flex min-h-[100svh] items-center justify-center px-5 pt-24">
        <div className="glow left-1/2 top-1/3 h-[400px] w-[400px] -translate-x-1/2" />

        <div className="relative w-full max-w-md text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--gold)]">
            <Check size={28} strokeWidth={1.5} className="text-[#0e0e0e]" />
          </span>

          <h1 className="mt-8 font-display text-[clamp(2rem,6vw,3rem)] leading-tight">
            Order in
          </h1>

          <p className="mt-5 leading-relaxed text-[var(--ivory-dim)]">
            The kitchen has it. Come to{" "}
            <span className="text-[var(--ivory)]">{branch?.name}</span> at{" "}
            <span className="text-[var(--gold)]">{collectionTime}</span> and it'll be
            waiting.
          </p>

          <div
            className="mt-8 border border-[var(--hairline)] p-6 text-left"
            style={{ borderRadius: "4px" }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[var(--ivory-dim)]">To pay on collection</span>
              <span className="font-display text-2xl text-[var(--gold)]">
                {gbp.format(placed.total)}
              </span>
            </div>

            {branch?.address && (
              <p className="mt-4 flex items-start gap-2.5 border-t border-[var(--hairline-faint)] pt-4 text-sm text-[var(--ivory-dim)]">
                <MapPin size={15} strokeWidth={1} className="mt-0.5 shrink-0" />
                {branch.address}
              </p>
            )}

            <p className="mt-3 font-mono text-[11px] text-[var(--muted)]">
              Order {placed.id}
            </p>
          </div>

          {branch?.phone && (
            <p className="mt-6 text-sm text-[var(--muted)]">
              Running late or need to change something? Ring{" "}
              
            <a href={`tel:${branch.phone.replace(/\s/g, "")}`}
                className="text-[var(--ivory-dim)] underline underline-offset-4"
              >
                {branch.phone}
              </a>
              .
            </p>
          )}
        </div>
      </section>
    );
  }

  // --- Branch ----------------------------------------------------------

  if (step === "branch") {
    return (
      <section className="relative min-h-[100svh] pt-32 sm:pt-40">
        <div className="glow left-1/4 top-0 h-[400px] w-[400px]" />

        <div className="relative mx-auto max-w-2xl px-5 pb-20 sm:px-8">
          <button
            onClick={onBack}
            className="mb-10 inline-flex items-center gap-2 text-sm text-[var(--ivory-dim)] hover:text-[var(--gold)]"
          >
            <ArrowLeft size={15} strokeWidth={1} />
            Back
          </button>

          <p className="label-caps text-[var(--gold)]">Collection</p>
          <h1 className="mt-4 font-display text-[clamp(2rem,6vw,3.5rem)] leading-tight">
            Where are you picking up?
          </h1>

          {loading ? (
            <p className="mt-10 text-sm text-[var(--muted)]">Loading…</p>
          ) : (
            <div className="mt-10 space-y-4">
              {branches.map((option) => (
                <button
                  key={option.id}
                  onClick={() => {
                    setBranch(option);
                    setStep("menu");
                  }}
                  className="group flex w-full items-center gap-5 border border-[var(--hairline-faint)] p-5 text-left transition-colors hover:border-[var(--gold)]"
                  style={{ borderRadius: "4px" }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-xl">{option.name}</p>
                    {option.address && (
                      <p className="mt-1 text-sm text-[var(--ivory-dim)]">
                        {option.address}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-[var(--gold)] opacity-0 transition-opacity group-hover:opacity-100">
                    →
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  // --- Details ---------------------------------------------------------

  if (step === "details") {
    return (
      <section className="relative min-h-[100svh] pt-32 sm:pt-40">
        <div className="relative mx-auto max-w-lg px-5 pb-32 sm:px-8">
          <button
            onClick={() => setStep("menu")}
            className="mb-10 inline-flex items-center gap-2 text-sm text-[var(--ivory-dim)] hover:text-[var(--gold)]"
          >
            <ArrowLeft size={15} strokeWidth={1} />
            Back to the menu
          </button>

          <p className="label-caps text-[var(--gold)]">Almost there</p>
          <h1 className="mt-4 font-display text-[clamp(1.75rem,5vw,2.75rem)] leading-tight">
            When shall we have it ready?
          </h1>

          {error && (
            <p className="mt-6 border border-[#ffb4ab]/30 bg-[#ffb4ab]/10 px-4 py-3 text-sm text-[#ffb4ab]">
              {error}
            </p>
          )}

          {/* Time — chips rather than a picker, since the choices are few
              and tapping beats scrolling a wheel. */}
          <div className="mt-8">
            <label className="label-caps mb-3 block text-[var(--muted)]">
              Collection time
            </label>

            {slots.length === 0 ? (
              <p className="text-sm text-[var(--ivory-dim)]">
                The kitchen's closed for collections today. Try tomorrow, or ring
                the restaurant.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setCollectionTime(slot)}
                    className={`border px-4 py-3 text-sm tabular-nums transition-colors ${
                      collectionTime === slot
                        ? "border-[var(--gold)] bg-[var(--gold)] text-[#0e0e0e]"
                        : "border-[var(--hairline-faint)] text-[var(--ivory-dim)] hover:border-[var(--hairline)]"
                    }`}
                    style={{ borderRadius: "4px" }}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8 space-y-5">
            <div>
              <label htmlFor="t-name" className="label-caps mb-2 block text-[var(--muted)]">
                Name
              </label>
              <input
                id="t-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Who's collecting"
                className="h-14 w-full border border-[var(--hairline-faint)] bg-[#1c1b1b] px-4 text-base text-[var(--ivory)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--gold)]"
                style={{ borderRadius: "4px" }}
              />
            </div>

            <div>
              <label htmlFor="t-phone" className="label-caps mb-2 block text-[var(--muted)]">
                Phone
              </label>
              <input
                id="t-phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="In case we need to reach you"
                className="h-14 w-full border border-[var(--hairline-faint)] bg-[#1c1b1b] px-4 text-base text-[var(--ivory)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--gold)]"
                style={{ borderRadius: "4px" }}
              />
            </div>

            <div>
              <label htmlFor="t-notes" className="label-caps mb-2 block text-[var(--muted)]">
                Anything else? <span className="normal-case">(optional)</span>
              </label>
              <textarea
                id="t-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Allergies, extra sauce, no onions…"
                className="w-full resize-none border border-[var(--hairline-faint)] bg-[#1c1b1b] px-4 py-3.5 text-base text-[var(--ivory)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--gold)]"
                style={{ borderRadius: "4px" }}
              />
            </div>
          </div>

          {/* Summary */}
          <div
            className="mt-8 border border-[var(--hairline-faint)] p-5"
            style={{ borderRadius: "4px" }}
          >
            <p className="label-caps mb-4 text-[var(--gold)]">Your order</p>
            <ul className="space-y-2.5">
              {cartLines.map(([id, qty]) => {
                const item = items.find((i) => i.id === id);
                if (!item) return null;
                return (
                  <li key={id} className="flex items-center gap-3 text-sm">
                    <span className="w-6 shrink-0 tabular-nums text-[var(--muted)]">
                      {qty}×
                    </span>
                    <span className="min-w-0 flex-1 truncate">{item.title}</span>
                    <span className="tabular-nums">
                      {gbp.format(effectivePrice(item) * qty)}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 flex items-center justify-between border-t border-[var(--hairline-faint)] pt-4">
              <span className="text-[var(--ivory-dim)]">Total</span>
              <span className="font-display text-2xl text-[var(--gold)]">
                {gbp.format(cartTotal)}
              </span>
            </div>

            <p className="mt-3 text-sm text-[var(--muted)]">Pay when you collect.</p>
          </div>

          <button
            onClick={submit}
            disabled={submitting || !name || !phone || !collectionTime}
            className="mt-8 w-full bg-[var(--gold)] py-5 text-base font-semibold text-[#0e0e0e] transition-colors hover:bg-[var(--gold-deep)] disabled:opacity-40"
            style={{ borderRadius: "4px" }}
          >
            {submitting ? "Sending…" : "Place order"}
          </button>
        </div>
      </section>
    );
  }

  // --- Menu ------------------------------------------------------------

  return (
    <section className="relative min-h-[100svh] pt-28 sm:pt-32">
      <div className="mx-auto max-w-[1440px] px-5 pb-32 sm:px-8 lg:px-12">
        <button
          onClick={() => setStep("branch")}
          className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--ivory-dim)] hover:text-[var(--gold)]"
        >
          <ArrowLeft size={15} strokeWidth={1} />
          {branch?.name}
        </button>

        <h1 className="font-display text-[clamp(1.75rem,5vw,3rem)] leading-tight">
          What are you having?
        </h1>

        {/* Categories */}
        <div className="sticky top-[73px] z-30 -mx-5 mt-6 bg-[#0e0e0e]/95 px-5 py-4 backdrop-blur sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {mains.map((main) => (
              <button
                key={main.id}
                onClick={() => setActiveMain(main.id)}
                className={`shrink-0 border px-4 py-2.5 text-sm transition-colors ${
                  activeMain === main.id
                    ? "border-[var(--gold)] bg-[var(--gold)] text-[#0e0e0e]"
                    : "border-[var(--hairline-faint)] text-[var(--ivory-dim)]"
                }`}
                style={{ borderRadius: "4px" }}
              >
                {main.name}
              </button>
            ))}
          </div>
        </div>

        {/* Items */}
        <ul className="mt-6 space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 lg:grid-cols-3">
          {visibleItems.map((item) => {
            const qty = cart[item.id] ?? 0;
            const discounted = item.promo_price != null;

            return (
              <li
                key={item.id}
                className="flex gap-3 border border-[var(--hairline-faint)] p-3"
                style={{ borderRadius: "4px" }}
              >
                <div className="relative h-24 w-24 shrink-0 overflow-hidden bg-[#1c1b1b]">
                  {item.picture && (
                    <Image
                      src={item.picture}
                      alt=""
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col">
                  <h3 className="font-display text-base leading-snug">{item.title}</h3>
                  {item.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-[var(--ivory-dim)]">
                      {item.description}
                    </p>
                  )}

                  <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                    <span className="flex items-baseline gap-2">
                      <span
                        className={`font-semibold tabular-nums ${
                          discounted ? "text-[var(--gold)]" : ""
                        }`}
                      >
                        {gbp.format(effectivePrice(item))}
                      </span>
                      {discounted && (
                        <span className="text-xs tabular-nums text-[var(--muted)] line-through">
                          {gbp.format(item.price)}
                        </span>
                      )}
                    </span>

                    {qty > 0 ? (
                      <div className="flex items-center gap-1 border border-[var(--hairline-faint)] p-1">
                        <button
                          onClick={() => change(item.id, -1)}
                          aria-label="One fewer"
                          className="flex h-7 w-7 items-center justify-center text-[var(--ivory-dim)]"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-5 text-center text-sm tabular-nums">{qty}</span>
                        <button
                          onClick={() => change(item.id, 1)}
                          aria-label="One more"
                          className="flex h-7 w-7 items-center justify-center bg-[var(--gold)] text-[#0e0e0e]"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => change(item.id, 1)}
                        className="bg-[var(--gold)] px-4 py-2 text-sm font-medium text-[#0e0e0e]"
                        style={{ borderRadius: "4px" }}
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
      </div>

      {/* Cart bar */}
      {cartCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--hairline)] bg-[#131313]">
          <div className="mx-auto max-w-2xl px-5 py-3">
            {cartOpen && (
              <div className="mb-3 max-h-56 space-y-2.5 overflow-y-auto border-b border-[var(--hairline-faint)] pb-3">
                {cartLines.map(([id, qty]) => {
                  const item = items.find((i) => i.id === id);
                  if (!item) return null;
                  return (
                    <div key={id} className="flex items-center gap-3 text-sm">
                      <span className="min-w-0 flex-1 truncate">{item.title}</span>
                      <button
                        onClick={() => change(id, -1)}
                        className="flex h-7 w-7 items-center justify-center text-[var(--muted)]"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="w-5 text-center tabular-nums">{qty}</span>
                      <button
                        onClick={() => change(id, 1)}
                        className="flex h-7 w-7 items-center justify-center text-[var(--gold)]"
                      >
                        <Plus size={13} />
                      </button>
                      <span className="w-16 text-right tabular-nums">
                        {gbp.format(effectivePrice(item) * qty)}
                      </span>
                      <button
                        onClick={() => setCart((prev) => ({ ...prev, [id]: 0 }))}
                        aria-label="Remove"
                        className="text-[var(--muted)]"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={() => setCartOpen((v) => !v)}
                className="flex items-center gap-2 text-sm text-[var(--ivory-dim)]"
              >
                <ShoppingBag size={18} />
                {cartCount}
              </button>
              <span className="flex-1 text-right font-semibold tabular-nums">
                {gbp.format(cartTotal)}
              </span>
              <button
                onClick={() => setStep("details")}
                className="bg-[var(--gold)] px-6 py-3.5 text-sm font-semibold text-[#0e0e0e]"
                style={{ borderRadius: "4px" }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}