"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MENU, type MenuCategory, type MenuItem } from "@/lib/menu-content";

gsap.registerPlugin(ScrollTrigger);

/**
 * A typographic menu — no photography per dish, because there isn't any yet.
 *
 * That's a constraint worth leaning into rather than apologising for: a
 * well-set menu reads as considered, where a grid of missing images reads as
 * broken. One image per food section arrives from the side to break the
 * rhythm; drinks are price lists and stay tight.
 */
export function MenuSections() {
  const [active, setActive] = useState(MENU[0].id);

  // Which section is currently in view, for the sticky category bar.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];

        if (visible) setActive(visible.target.id);
      },
      // The band sits below the sticky header, so a section counts as
      // "current" once its top passes that line.
      { rootMargin: "-140px 0px -60% 0px" }
    );

    MENU.forEach((category) => {
      const el = document.getElementById(category.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const food = MENU.filter((c) => c.kind === "food");
  const drink = MENU.filter((c) => c.kind === "drink");

  return (
    <>
      <CategoryNav active={active} />

      <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
        {food.map((category, i) => (
          <FoodSection key={category.id} category={category} index={i} />
        ))}

        {/* The drinks half announces itself — the change of pace should feel
            deliberate rather than like the page running out of steam. */}
        <div className="relative py-16 text-center sm:py-24">
          <span className="mx-auto block h-px w-16 bg-[var(--hairline)]" />
          <h2 className="mt-8 font-display text-[clamp(2rem,6vw,3.5rem)] leading-none tracking-[-0.02em]">
            The bar
          </h2>
          <p className="mt-4 text-[var(--ivory-dim)]">
            Cocktails, spirits and everything alongside.
          </p>
        </div>

        {/* Photograph beside the lists rather than stacked above them.
            minmax(0,…) on both tracks matters: grid columns are auto-sized to
            their content by default, so one long drink name would otherwise
            widen the track and push the page into sideways scroll on a
            phone — the failure this section is most prone to. */}
        <div className="grid gap-10 pb-20 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.7fr)] lg:items-start lg:gap-16">
          {/* Sticky so it stays with the lists down a tall desktop column;
              on narrow screens there is no "side", so it simply leads the
              section, bled off the left edge like the food photographs. */}
          <div className="lg:sticky lg:top-36">
            <div className="relative -ml-5 aspect-[4/5] w-[80%] overflow-hidden sm:-ml-8 sm:w-[60%] lg:ml-0 lg:aspect-[3/4] lg:w-full">
              <Image
                src="/images/menu/drinks.webp"
                alt="A bartender pouring over a foamed cocktail at the Sweet1NE bar"
                fill
                sizes="(max-width: 640px) 80vw, (max-width: 1024px) 60vw, 30vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e]/60 to-transparent" />
              <span className="pointer-events-none absolute inset-2 border border-white/[0.07]" />
            </div>
          </div>

          {/* The lists keep a two-up arrangement wherever there's width for
              it, so the photograph doesn't double the section's height. The
              width available here isn't monotonic — it grows to md, then
              halves at lg when the photograph claims its column, then grows
              again — so the column count has to track that, not the viewport. */}
          <div className="grid gap-x-12 gap-y-14 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {drink.map((category) => (
              <DrinkSection key={category.id} category={category} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

function CategoryNav({ active }: { active: string }) {
  const railRef = useRef<HTMLDivElement>(null);

  // Keep the active chip in view as you scroll — otherwise on mobile the
  // current section's chip drifts off the edge and the bar stops helping.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const chip = rail.querySelector<HTMLElement>(`[data-chip="${active}"]`);
    if (!chip) return;

    rail.scrollTo({
      left: chip.offsetLeft - rail.clientWidth / 2 + chip.offsetWidth / 2,
      behavior: "smooth",
    });
  }, [active]);

  return (
    <div className="sticky top-[73px] z-30 border-y border-[var(--hairline-faint)] bg-[#0e0e0e]/95 backdrop-blur">
      <div
        ref={railRef}
        className="mx-auto flex max-w-[1440px] gap-1 overflow-x-auto px-5 py-3 sm:px-8 lg:px-12 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {MENU.map((category) => (
          
          <a  key={category.id}
            href={`#${category.id}`}
            data-chip={category.id}
            className={`shrink-0 px-3.5 py-2 text-sm transition-colors ${
              active === category.id
                ? "text-[var(--gold)]"
                : "text-[var(--muted)] hover:text-[var(--ivory-dim)]"
            }`}
          >
            {category.name}
          </a>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function FoodSection({
  category,
  index,
}: {
  category: MenuCategory;
  index: number;
}) {
  const ref = useRef<HTMLElement>(null);
  // Images alternate sides, and break out past the container on their own
  // edge — the same language the homepage uses.
  const fromLeft = index % 2 === 0;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      const frame = el.querySelector(".menu-frame");
      if (frame) {
        gsap.fromTo(
          frame,
          { xPercent: fromLeft ? -40 : 40, opacity: 0 },
          {
            xPercent: 0,
            opacity: 1,
            ease: "power4.out",
            scrollTrigger: { trigger: el, start: "top 85%", end: "top 45%", scrub: 1 },
          }
        );

        gsap.fromTo(
          el.querySelector(".menu-photo"),
          { filter: "blur(16px)", scale: 1.18 },
          {
            filter: "blur(0px)",
            scale: 1,
            ease: "none",
            scrollTrigger: { trigger: el, start: "top 85%", end: "top 45%", scrub: 1 },
          }
        );
      }

      // The heading and its tagline rise as the section opens.
      gsap.fromTo(
        el.querySelectorAll(".menu-head"),
        { y: 28, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.9,
          stagger: 0.1,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 78%", once: true },
        }
      );

      // Items arrive in sequence — quick enough not to hold anyone up.
      gsap.fromTo(
        el.querySelectorAll(".menu-item"),
        { y: 20, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.6,
          stagger: 0.04,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 70%", once: true },
        }
      );
    }, el);

    return () => ctx.revert();
  }, [fromLeft]);

  return (
    <section
      ref={ref}
      id={category.id}
      // scroll-mt clears the fixed header and the category bar when an
      // anchor lands.
      className="scroll-mt-32 border-t border-[var(--hairline-faint)] py-14 first:border-0 sm:py-20"
    >
      <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
        {/* Heading and image */}
        <div className={fromLeft ? "" : "lg:order-2"}>
          <div className="lg:sticky lg:top-36">
            <h2 className="menu-head font-display text-[clamp(1.875rem,5vw,3rem)] leading-[1] tracking-[-0.02em]">
              {category.name}
            </h2>

            {category.tagline && (
              <p className="menu-head mt-4 max-w-sm text-[15px] leading-relaxed text-[var(--ivory-dim)]">
                {category.tagline}
              </p>
            )}

            {category.image && (
              <div
                className={`menu-frame relative mt-8 aspect-[4/5] overflow-hidden ${
                  fromLeft ? "-ml-5 w-[80%] sm:-ml-8 lg:ml-0 lg:w-full" : "ml-auto -mr-5 w-[80%] sm:-mr-8 lg:mr-0 lg:w-full"
                }`}
              >
                <div className="menu-photo absolute inset-0">
                  <Image
                    src={category.image}
                    alt=""
                    fill
                    sizes="(max-width: 1024px) 80vw, 30vw"
                    className="object-cover"
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e]/60 to-transparent" />
                <span className="pointer-events-none absolute inset-2 border border-white/[0.07]" />
              </div>
            )}
          </div>
        </div>

        {/* Items */}
        <div className={fromLeft ? "" : "lg:order-1"}>
          <ul className="space-y-7">
            {category.items.map((item) => (
              <MenuRow key={item.name} item={item} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function MenuRow({ item }: { item: MenuItem }) {
  return (
    <li className="menu-item">
      {/* The dotted leader between name and price is the one bit of
          traditional menu typography worth keeping — it's how the eye
          tracks across. */}
      <div className="flex items-baseline gap-3">
        <h3 className="font-display text-lg leading-snug text-[var(--ivory)] sm:text-xl">
          {item.name}
        </h3>

        {item.price && (
          <>
            <span className="min-w-4 flex-1 translate-y-[-4px] border-b border-dotted border-[var(--hairline-faint)]" />
            <span className="shrink-0 font-display text-lg text-[var(--gold)] sm:text-xl">
              £{item.price}
            </span>
          </>
        )}
      </div>

      {item.variant && (
        <p className="mt-1.5 text-sm text-[var(--gold)]">{item.variant}</p>
      )}

      {item.description && (
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-[var(--ivory-dim)]">
          {item.description}
        </p>
      )}

      {/* Named sub-options, each with their own line. */}
      {item.choices && (
        <ul className="mt-2.5 space-y-1.5 border-l border-[var(--hairline-faint)] pl-4">
          {item.choices.map((choice) => (
            <li key={choice.name} className="text-[15px] leading-relaxed">
              <span className="text-[var(--ivory)]">{choice.name}</span>
              {choice.description && (
                <span className="text-[var(--ivory-dim)]"> — {choice.description}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* A priced grid — boil components, ice cream flavours. */}
      {item.options && (
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border-l border-[var(--hairline)] pl-4 sm:grid-cols-3">
          {item.options.map((option) => (
            <p key={option.name} className="text-sm">
              <span className="text-[var(--ivory-dim)]">{option.name}</span>{" "}
              <span className="text-[var(--gold)]">£{option.price}</span>
            </p>
          ))}
        </div>
      )}

      {item.note && (
        <p className="mt-2 text-sm italic text-[var(--muted)]">{item.note}</p>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */

function DrinkSection({ category }: { category: MenuCategory }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        el.querySelectorAll(".drink-line"),
        { y: 16, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.5,
          stagger: 0.03,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 85%", once: true },
        }
      );
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={ref} id={category.id} className="scroll-mt-32">
      <h2 className="drink-line font-display text-2xl leading-none tracking-[-0.01em] sm:text-[1.75rem]">
        {category.name}
      </h2>

      <span className="drink-line mt-4 block h-px w-10 bg-[var(--gold)]" />

      <ul className="mt-6 space-y-3.5">
        {category.items.map((item) => (
          <li key={item.name} className="drink-line">
            <div className="flex items-baseline gap-3">
              <span className="text-[var(--ivory)]">{item.name}</span>

              {item.price && (
                <>
                  <span className="min-w-4 flex-1 translate-y-[-4px] border-b border-dotted border-[var(--hairline-faint)]" />
                  <span className="shrink-0 font-display text-[var(--gold)]">
                    £{item.price}
                  </span>
                </>
              )}
            </div>

            {item.variant && (
              <p className="mt-1 text-sm text-[var(--muted)]">{item.variant}</p>
            )}

            {item.note && (
              <p className="mt-1 text-sm italic text-[var(--muted)]">{item.note}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}