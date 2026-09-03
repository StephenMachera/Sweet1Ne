"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { UtensilsCrossed } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

type Category = { id: string; name: string; parent_id: string | null };

type Item = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  promo_price: number | null;
  promo_titles: string[];
  picture: string | null;
  dietary_tags: string[];
  allergen_tags: string[];
  main_category_id: string;
  sub_category_id: string;
  branch_ids: string[];
};

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

/** Short marks rather than badges — they shouldn't compete with the food. */
const DIETARY_MARKS: Record<string, string> = {
  vegetarian: "V",
  vegan: "VG",
  gluten_free: "GF",
  dairy_free: "DF",
  halal: "H",
  low_calorie: "LC",
};

export function MenuGrid() {
  const gridRef = useRef<HTMLDivElement>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [activeMain, setActiveMain] = useState<string | null>(null);
  const [activeSub, setActiveSub] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/public/site/menu`)
      .then((res) => res.json())
      .then((data) => {
        setCategories(data.categories);
        setItems(data.items);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // The filter bar shrinks once you're into the list — always reachable,
  // but not eating the screen.
  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const mains = useMemo(
    () => categories.filter((c) => c.parent_id === null),
    [categories]
  );

  const subs = useMemo(
    () => categories.filter((c) => c.parent_id === activeMain),
    [categories, activeMain]
  );

  const visible = useMemo(() => {
    return items.filter((item) => {
      if (activeSub) return item.sub_category_id === activeSub;
      if (activeMain) return item.main_category_id === activeMain;
      return true;
    });
  }, [items, activeMain, activeSub]);

  // Items surface as they enter — blurred and enlarged, resolving into
  // focus, in the same language as the rest of the site. Staggered by
  // column so a row assembles rather than appearing.
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || loading) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".menu-card").forEach((card, i) => {
        const photo = card.querySelector(".menu-photo");

        gsap.fromTo(
          card,
          { y: 48, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.9,
            // Position within the row, not the whole grid — otherwise later
            // items would wait an absurd amount of time.
            delay: (i % 3) * 0.08,
            ease: "power3.out",
            scrollTrigger: { trigger: card, start: "top 92%", once: true },
          }
        );

        gsap.fromTo(
          photo,
          { filter: "blur(18px)", scale: 1.22 },
          {
            filter: "blur(0px)",
            scale: 1,
            duration: 1.3,
            delay: (i % 3) * 0.08,
            ease: "power3.out",
            scrollTrigger: { trigger: card, start: "top 92%", once: true },
          }
        );
      });
    }, grid);

    return () => ctx.revert();
  }, [loading, visible.length]);

  // Filtering rebuilds the grid — the new set surfaces rather than swapping
  // in, so changing category feels like the menu reassembling.
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || loading) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const cards = grid.querySelectorAll(".menu-card");
    if (!cards.length) return;

    gsap.fromTo(
      cards,
      { y: 24, opacity: 0, filter: "blur(8px)" },
      {
        y: 0,
        opacity: 1,
        filter: "blur(0px)",
        duration: 0.7,
        stagger: 0.03,
        ease: "power3.out",
        overwrite: true,
      }
    );
  }, [activeMain, activeSub, loading]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-[4/5] animate-pulse bg-[#1c1b1b]" />
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Filters — sticky beneath the header, compressing on scroll. */}
      <div
        className={`sticky top-[73px] z-30 -mx-5 border-b border-[var(--hairline-faint)] bg-[#0e0e0e]/95 px-5 backdrop-blur transition-all duration-500 sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12 ${
          compact ? "py-3" : "py-5"
        }`}
      >
        <div className="mx-auto max-w-[1440px]">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              onClick={() => {
                setActiveMain(null);
                setActiveSub(null);
              }}
              className={`shrink-0 border transition-all duration-500 ${
                compact ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm"
              } ${
                activeMain === null
                  ? "border-[var(--gold)] bg-[var(--gold)] text-[#0e0e0e]"
                  : "border-[var(--hairline-faint)] text-[var(--ivory-dim)] hover:border-[var(--hairline)]"
              }`}
              style={{ borderRadius: "4px" }}
            >
              Everything
            </button>

            {mains.map((main) => (
              <button
                key={main.id}
                onClick={() => {
                  setActiveMain(main.id);
                  setActiveSub(null);
                }}
                className={`shrink-0 border transition-all duration-500 ${
                  compact ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm"
                } ${
                  activeMain === main.id
                    ? "border-[var(--gold)] bg-[var(--gold)] text-[#0e0e0e]"
                    : "border-[var(--hairline-faint)] text-[var(--ivory-dim)] hover:border-[var(--hairline)]"
                }`}
                style={{ borderRadius: "4px" }}
              >
                {main.name}
              </button>
            ))}
          </div>

          {/* Subcategories only appear once a main is chosen. */}
          {subs.length > 0 && (
            <div className="-mx-1 mt-2 flex gap-4 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                onClick={() => setActiveSub(null)}
                className={`shrink-0 border-b pb-1 text-xs transition-colors ${
                  activeSub === null
                    ? "border-[var(--gold)] text-[var(--gold)]"
                    : "border-transparent text-[var(--muted)] hover:text-[var(--ivory-dim)]"
                }`}
              >
                All
              </button>
              {subs.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => setActiveSub(sub.id)}
                  className={`shrink-0 border-b pb-1 text-xs transition-colors ${
                    activeSub === sub.id
                      ? "border-[var(--gold)] text-[var(--gold)]"
                      : "border-transparent text-[var(--muted)] hover:text-[var(--ivory-dim)]"
                  }`}
                >
                  {sub.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* The grid. Every seventh item spans two columns — a uniform grid
          reads as a catalogue; breaking the rhythm makes it a magazine. */}
      <div
        ref={gridRef}
        className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        {visible.map((item, i) => (
          <MenuCard key={item.id} item={item} wide={i % 7 === 3} />
        ))}
      </div>

      {visible.length === 0 && (
        <p className="py-24 text-center text-sm text-[var(--muted)]">
          Nothing in this part of the menu just yet.
        </p>
      )}
    </>
  );
}

function MenuCard({ item, wide }: { item: Item; wide: boolean }) {
  const discounted = item.promo_price != null;
  const marks = item.dietary_tags.map((tag) => DIETARY_MARKS[tag]).filter(Boolean);

  return (
    <article
      // opacity 0 in the initial style — GSAP brings it in. Without this the
      // card flashes at full opacity before the animation starts.
      className={`menu-card group relative overflow-hidden bg-[#1c1b1b] ${
        wide ? "sm:col-span-2 sm:aspect-[8/5]" : "aspect-[4/5]"
      }`}
      style={{ opacity: 0 }}
    >
      {item.picture ? (
        <div className="menu-photo absolute inset-0">
          <Image
            src={item.picture}
            alt={item.title}
            fill
            sizes={wide ? "(max-width: 640px) 100vw, 66vw" : "(max-width: 640px) 100vw, 33vw"}
            className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.04]"
          />
        </div>
      ) : (
        // Fallback: the dish name set large in Bodoni, so a missing photo
        // still looks deliberate rather than broken.
        <div className="menu-photo absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#1c1b1b] to-[#0e0e0e] p-8">
          <div className="text-center">
            <UtensilsCrossed
              size={28}
              strokeWidth={0.75}
              className="mx-auto mb-4 text-[var(--gold)]/40"
            />
            <p className="font-display text-2xl text-[var(--ivory-dim)]">{item.title}</p>
          </div>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e] via-[#0e0e0e]/20 to-transparent" />

      {marks.length > 0 && (
        <div className="absolute right-3 top-3 flex gap-1.5">
          {marks.map((mark) => (
            <span
              key={mark}
              className="label-caps flex h-7 min-w-7 items-center justify-center border border-[var(--hairline)] bg-black/40 px-1.5 text-[10px] text-[var(--gold)] backdrop-blur"
              style={{ borderRadius: "4px" }}
            >
              {mark}
            </span>
          ))}
        </div>
      )}

      {discounted && (
        <span
          className="label-caps absolute left-3 top-3 bg-[var(--gold)] px-2.5 py-1 text-[10px] text-[#0e0e0e]"
          style={{ borderRadius: "4px" }}
        >
          Offer
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 p-5">
        <div className="flex items-end justify-between gap-3">
          <h3 className="font-display text-xl leading-tight sm:text-2xl">{item.title}</h3>

          <span className="shrink-0 text-right">
            {discounted ? (
              <>
                <span className="block font-display text-xl text-[var(--gold)]">
                  {gbp.format(item.promo_price!)}
                </span>
                <span className="block text-xs text-[var(--muted)] line-through">
                  {gbp.format(item.price)}
                </span>
              </>
            ) : (
              <span className="font-display text-xl text-[var(--gold)]">
                {gbp.format(item.price)}
              </span>
            )}
          </span>
        </div>

        {/* Description rises on hover; always visible on touch, where there
            is no hover to reveal it. */}
        {item.description && (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--ivory-dim)] transition-all duration-500 sm:max-h-0 sm:overflow-hidden sm:opacity-0 sm:group-hover:mt-2 sm:group-hover:max-h-20 sm:group-hover:opacity-100">
            {item.description}
          </p>
        )}

        {item.allergen_tags.length > 0 && (
          <p className="mt-2 text-[11px] capitalize text-[var(--muted)]">
            Contains {item.allergen_tags.map((t) => t.replace(/_/g, " ")).join(", ")}
          </p>
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 border border-transparent transition-colors duration-500 group-hover:border-[var(--hairline)]" />
    </article>
  );
}