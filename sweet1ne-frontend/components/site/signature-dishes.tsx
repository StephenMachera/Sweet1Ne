"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Eyebrow } from "./section";

gsap.registerPlugin(ScrollTrigger);

export type Dish = {
  id: string;
  name: string;
  description: string;
  image: string;
  note?: string;
};

export function SignatureDishes({ dishes }: { dishes: Dish[] }) {
  return (
    <>
      <DesktopDishes dishes={dishes} />
      <MobileDishes dishes={dishes} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Desktop — unchanged                                                 */
/* ------------------------------------------------------------------ */

function DesktopDishes({ dishes }: { dishes: Dish[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!isDesktop || reduced) return;

    const ctx = gsap.context(() => {
      const layers = gsap.utils.toArray<HTMLElement>(".dish-layer");
      const texts = gsap.utils.toArray<HTMLElement>(".dish-text");

      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: () => `+=${dishes.length * 100}%`,
          pin: true,
          scrub: 1,
          onUpdate: (self) => {
            setActive(
              Math.min(dishes.length - 1, Math.floor(self.progress * dishes.length))
            );
          },
        },
      });

      layers.forEach((layer, i) => {
        const image = layer.querySelector(".dish-image");
        const text = texts[i];

        timeline
          .fromTo(layer, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "power2.out" }, i)
          .fromTo(
            image,
            { filter: "blur(24px)", scale: 1.2 },
            { filter: "blur(0px)", scale: 1, duration: 0.6, ease: "power2.out" },
            i
          )
          .fromTo(
            text,
            { opacity: 0, y: 30 },
            { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" },
            i + 0.25
          );

        if (i < layers.length - 1) {
          timeline
            .to(text, { opacity: 0, y: -30, duration: 0.3 }, i + 0.7)
            .to(image, { filter: "blur(16px)", scale: 0.94, duration: 0.4 }, i + 0.65)
            .to(layer, { opacity: 0, duration: 0.4 }, i + 0.65);
        }
      });
    }, section);

    return () => ctx.revert();
  }, [dishes.length]);

  return (
    <section ref={sectionRef} className="relative hidden h-screen overflow-hidden lg:block">
      {dishes.map((dish, i) => (
        <div
          key={dish.id}
          className="dish-layer absolute inset-0"
          style={{ opacity: i === 0 ? 1 : 0 }}
        >
          <div className="dish-image absolute inset-0">
            <Image
              src={dish.image}
              alt={dish.name}
              fill
              priority={i === 0}
              sizes="100vw"
              className="object-cover"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e] via-[#0e0e0e]/40 to-[#0e0e0e]/60" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0e0e0e]/70 via-transparent to-transparent" />
        </div>
      ))}

      <div className="glow left-[15%] top-1/3 h-[520px] w-[520px]" />

      <div className="relative z-10 mx-auto flex h-full max-w-[1440px] flex-col justify-center px-12">
        <Eyebrow>What people come for</Eyebrow>

        <div className="relative h-64">
          {dishes.map((dish) => (
            <div key={dish.id} className="dish-text absolute inset-0" style={{ opacity: 0 }}>
              {dish.note && <p className="label-caps mb-4 text-[var(--gold)]">{dish.note}</p>}
              <h2 className="max-w-2xl font-display text-[clamp(3rem,6vw,5rem)] leading-[0.95] tracking-[-0.02em]">
                {dish.name}
              </h2>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-[var(--ivory-dim)]">
                {dish.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-10 z-10">
        <div className="mx-auto flex max-w-[1440px] items-center gap-6 px-12">
          <div className="flex flex-1 gap-1.5">
            {dishes.map((dish, i) => (
              <span
                key={dish.id}
                className={`h-px flex-1 transition-colors duration-500 ${
                  i === active ? "bg-[var(--gold)]" : "bg-white/12"
                }`}
              />
            ))}
          </div>
          <Link
            href="/menu"
            className="shrink-0 border-b border-[var(--ivory)]/30 pb-1 text-sm text-[var(--ivory-dim)] transition-colors hover:border-[var(--gold)] hover:text-[var(--gold)]"
          >
            Full menu
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Mobile — a horizontal culinary journey                              */
/* ------------------------------------------------------------------ */

/**
 * One dish dominates; the next sits at the edge, inviting the swipe.
 *
 * Horizontal rather than vertical, so it never competes with the page's own
 * scroll — and because sideways movement through a sequence reads as a
 * journey rather than a list.
 */
function MobileDishes({ dishes }: { dishes: Dish[] }) {
  const railRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  // Which slide is nearest the centre — measured from the rail rather than
  // tracked in state, so a swipe and a tap can't disagree.
  const syncActive = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;

    const centre = rail.scrollLeft + rail.clientWidth / 2;
    let nearest = 0;
    let smallest = Infinity;

    Array.from(rail.children).forEach((child, i) => {
      const el = child as HTMLElement;
      if (!el.dataset.slide) return;

      const slideCentre = el.offsetLeft + el.offsetWidth / 2;
      const distance = Math.abs(slideCentre - centre);
      if (distance < smallest) {
        smallest = distance;
        nearest = Number(el.dataset.slide);
      }
    });

    setActive(nearest);
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    syncActive();
    rail.addEventListener("scroll", syncActive, { passive: true });
    window.addEventListener("resize", syncActive);

    return () => {
      rail.removeEventListener("scroll", syncActive);
      window.removeEventListener("resize", syncActive);
    };
  }, [syncActive]);

  return (
    <section className="relative overflow-hidden py-14 lg:hidden">
      <div className="glow left-[-15%] top-1/4 h-[380px] w-[380px] opacity-70" />

      {/* Header */}
      <div className="relative mb-8 px-5 sm:px-8">
        <Eyebrow>Signature dishes</Eyebrow>
        <h2 className="font-display text-[clamp(2rem,9vw,2.75rem)] leading-[1.02] tracking-[-0.02em]">
          The ones worth
          <br />
          <span className="text-[var(--gold)]">the journey.</span>
        </h2>
      </div>

      {/* The rail. Native touch scrolling with snap — momentum and physics
          come free, and it never feels like a JavaScript carousel. */}
      <div
        ref={railRef}
        className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden"
      >
        {/* Leading gutter so the first slide sits inset rather than flush. */}
        <div className="w-5 shrink-0 sm:w-8" aria-hidden />

        {dishes.map((dish, i) => (
          <MobileDish
            key={dish.id}
            dish={dish}
            index={i}
            total={dishes.length}
            isActive={i === active}
          />
        ))}

        {/* Trailing gutter lets the last slide reach the same inset. */}
        <div className="w-5 shrink-0 sm:w-8" aria-hidden />
      </div>

      {/* Position and progress — no arrows, no dots. */}
      <div className="relative mt-7 flex items-center gap-5 px-5 sm:px-8">
        <p className="shrink-0 font-display text-lg tabular-nums text-[var(--gold)]">
          {String(active + 1).padStart(2, "0")}
          <span className="text-[var(--muted)]"> / {String(dishes.length).padStart(2, "0")}</span>
        </p>

        <span className="h-px flex-1 bg-white/12">
          <span
            className="block h-full bg-[var(--gold)] transition-all duration-500 ease-out"
            style={{ width: `${((active + 1) / dishes.length) * 100}%` }}
          />
        </span>

        <Link
          href="/menu"
          className="shrink-0 border-b border-[var(--gold)]/50 pb-0.5 text-sm text-[var(--gold)]"
        >
          Full menu
        </Link>
      </div>
    </section>
  );
}

function MobileDish({
  dish,
  index,
  total,
  isActive,
}: {
  dish: Dish;
  index: number;
  total: number;
  isActive: boolean;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      // Surfaces on first entry — the same blur-to-focus language as the
      // desktop section, so the page keeps one motion vocabulary.
      gsap.fromTo(
        el.querySelector(".dish-photo"),
        { filter: "blur(18px)", scale: 1.18 },
        {
          filter: "blur(0px)",
          scale: 1,
          duration: 1.2,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 85%", once: true },
        }
      );

      // Information arrives after the food, staggered rather than together.
      gsap.fromTo(
        el.querySelectorAll(".dish-line"),
        { y: 24, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.7,
          stagger: 0.08,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 80%", once: true },
        }
      );
    }, el);

    return () => ctx.revert();
  }, []);

  // Every third slide crops taller and shifts its number — enough variation
  // that they don't read as one template repeated.
  const tall = index % 3 === 1;

  return (
    <article
      ref={ref}
      data-slide={index}
      // 82vw leaves a genuine glimpse of what's next, which is what makes
      // the swipe discoverable without any instruction.
      className={`relative shrink-0 snap-center transition-opacity duration-500 ${
        isActive ? "opacity-100" : "opacity-55"
      }`}
      style={{ width: "min(82vw, 420px)" }}
    >
      {/* Oversized number, half outside the frame — the deliberate break
          from a card. */}
      <span
        className={`pointer-events-none absolute z-20 font-display leading-none text-[var(--gold)] ${
          tall ? "-left-1 top-6" : "-left-1 top-4"
        }`}
        style={{
          fontSize: "clamp(3.5rem, 16vw, 5.5rem)",
          // Outlined rather than filled, so it sits over the photograph
          // without obscuring it.
          WebkitTextStroke: "1px currentColor",
          color: "transparent",
          opacity: 0.85,
        }}
        aria-hidden
      >
        {String(index + 1).padStart(2, "0")}
      </span>

      <div
        className={`relative overflow-hidden ${tall ? "aspect-[3/4.4]" : "aspect-[3/4]"}`}
      >
        <div className="dish-photo absolute inset-0">
          <Image
            src={dish.image}
            alt={dish.name}
            fill
            priority={index === 0}
            sizes="82vw"
            className="object-cover"
          />
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e] via-[#0e0e0e]/10 to-transparent" />

        {/* Hairline mount, inset — reads as a print rather than a card. */}
        <span className="pointer-events-none absolute inset-2.5 border border-white/10" />

        <p className="dish-line label-caps absolute right-4 top-5 text-[var(--gold)]">
          Signature
        </p>
      </div>

      {/* Text sits below and slightly overlapping, breaking the frame's
          bottom edge rather than living inside it. */}
      <div className={`relative z-10 px-1 ${tall ? "-mt-8" : "-mt-10"}`}>
        <h3 className="dish-line font-display text-[clamp(1.75rem,7.5vw,2.5rem)] leading-[0.98] tracking-[-0.02em]">
          {dish.name}
        </h3>

        {dish.note && (
          <p className="dish-line label-caps mt-3 text-[var(--gold)]">{dish.note}</p>
        )}

        <p className="dish-line mt-3 text-[15px] leading-relaxed text-[var(--ivory-dim)]">
          {dish.description}
        </p>

        <div className="dish-line mt-4 flex items-baseline gap-4">
          <span className="h-px flex-1 bg-[var(--hairline-faint)]" />
        </div>
      </div>
    </article>
  );
}