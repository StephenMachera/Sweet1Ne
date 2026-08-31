"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Eyebrow, Heading } from "./section";

export type Dish = {
  id: string;
  name: string;
  description: string;
  price: string;
  image: string;
  /** Small caps line above the name — "SERVES 4", "THE ONE FROM TIKTOK". */
  note?: string;
};

/**
 * The pass.
 *
 * Dishes move past you the way plates move down a service line — the one in
 * front is lit and full-size, the ones either side are dimmed and set back.
 * Touch swipes it, arrows step it, and the whole thing is a scroll container
 * underneath so it degrades to something usable with JavaScript off.
 */
export function SignatureDishes({ dishes }: { dishes: Dish[] }) {
  const railRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  // Which card is nearest the centre — used to light it and dim the rest.
  const syncActive = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;

    const centre = rail.scrollLeft + rail.clientWidth / 2;
    let nearest = 0;
    let smallest = Infinity;

    Array.from(rail.children).forEach((child, i) => {
      const el = child as HTMLElement;
      const cardCentre = el.offsetLeft + el.offsetWidth / 2;
      const distance = Math.abs(cardCentre - centre);
      if (distance < smallest) {
        smallest = distance;
        nearest = i;
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

  function step(direction: -1 | 1) {
    const rail = railRef.current;
    if (!rail) return;

    const target = rail.children[active + direction] as HTMLElement | undefined;
    if (!target) return;

    // Centre the target rather than scrolling by a fixed amount — keeps the
    // rhythm right regardless of card width at this breakpoint.
    rail.scrollTo({
      left: target.offsetLeft - (rail.clientWidth - target.offsetWidth) / 2,
      behavior: "smooth",
    });
  }

  return (
    <section className="relative z-10 overflow-hidden py-12 sm:py-20">
      <div className="glow left-[-10%] top-1/4 h-[500px] w-[500px]" />

      {/* Header — arrows sit with it rather than floating over the rail. */}
      <div className="mx-auto mb-10 flex max-w-[1440px] items-end justify-between gap-6 px-5 sm:mb-14 sm:px-6">
        <div>
          <Eyebrow>What people come for</Eyebrow>
          <Heading accent="the journey.">The ones worth</Heading>
        </div>

        <div className="hidden shrink-0 gap-2 sm:flex">
          <button
            onClick={() => step(-1)}
            disabled={active === 0}
            aria-label="Previous dish"
            className="flex h-12 w-12 items-center justify-center border border-[var(--hairline)] text-[var(--ivory)] transition-all hover:border-[var(--gold)] hover:text-[var(--gold)] disabled:opacity-25"
            style={{ borderRadius: "4px" }}
          >
            <ArrowLeft size={18} strokeWidth={1} />
          </button>
          <button
            onClick={() => step(1)}
            disabled={active === dishes.length - 1}
            aria-label="Next dish"
            className="flex h-12 w-12 items-center justify-center border border-[var(--hairline)] text-[var(--ivory)] transition-all hover:border-[var(--gold)] hover:text-[var(--gold)] disabled:opacity-25"
            style={{ borderRadius: "4px" }}
          >
            <ArrowRight size={18} strokeWidth={1} />
          </button>
        </div>
      </div>

      {/* The rail. Scroll-snap does the work — swipe on touch, arrows on
          pointer, and it still scrolls if the JS never loads. */}
      <div
        ref={railRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 sm:gap-6 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {/* Spacers let the first and last card reach the centre. */}
        <div className="w-0 shrink-0 lg:w-[calc((100vw-1280px)/2)]" aria-hidden />

        {dishes.map((dish, i) => {
          const isActive = i === active;

          return (
            <article
              key={dish.id}
              className={`group relative shrink-0 snap-center transition-all duration-500 ${
                isActive ? "opacity-100" : "opacity-45"
              }`}
              style={{
                width: "min(76vw, 400px)",
              }}
            >
              <div
                className={`relative aspect-[4/5] overflow-hidden transition-all duration-500 ${
                  isActive ? "scale-100" : "scale-[0.94]"
                }`}
              >
                <Image
                  src={dish.image}
                  alt={dish.name}
                  fill
                  sizes="(max-width: 640px) 76vw, 400px"
                  className="object-cover"
                />

                {/* Text sits on the image, not beneath it — the reference
                    designs put every dish in a grey card, which flattens
                    them. */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e] via-[#0e0e0e]/10 to-transparent" />

                <div className="absolute inset-x-0 bottom-0 p-6 sm:p-7">
                  {dish.note && (
                    <p className="label-caps mb-3 text-[var(--gold)]">{dish.note}</p>
                  )}

                  <h3 className="font-display text-[1.75rem] leading-tight sm:text-[2rem]">
                    {dish.name}
                  </h3>

                  <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--ivory-dim)]">
                    {dish.description}
                  </p>

                  {/* Bodoni on the price — it's part of the appeal, not a
                      functional number to apologise for. */}
                  <p className="mt-5 font-display text-2xl text-[var(--gold)]">
                    {dish.price}
                  </p>
                </div>

                {/* Hairline that firms up on the active card. */}
                <div
                  className={`pointer-events-none absolute inset-0 border transition-colors duration-500 ${
                    isActive ? "border-[var(--hairline)]" : "border-transparent"
                  }`}
                />
              </div>
            </article>
          );
        })}

        <div className="w-0 shrink-0 lg:w-[calc((100vw-1280px)/2)]" aria-hidden />
      </div>

      {/* Progress — a thin gold rule per dish, filled for the active one.
          Reads better than dots at this scale. */}
      <div className="mx-auto mt-8 flex max-w-[1440px] items-center gap-6 px-5 sm:px-6">
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
    </section>
  );
}