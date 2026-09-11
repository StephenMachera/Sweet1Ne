"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type Stop = {
  year: string;
  place: string;
  image: string;
  alt: string;
};

const STOPS: Stop[] = [
  {
    year: "2019",
    place: "Fairlop",
    image: "/images/homepage-gallery/story/01-the-kitchen.jpg",
    alt: "Sweet1ne sharing table — Afro-Caribbean plates",
  },
  {
    year: "2023",
    place: "Lewisham",
    image: "/images/homepage-gallery/story/hero-lewisham-a.jpg",
    alt: "Sweet1ne Lewisham — gold room, circular mirror, blossom",
  },
  {
    year: "2025",
    place: "Chingford",
    image: "/images/homepage-gallery/story/hero-chingford-2.jpg",
    alt: "Sweet1ne Chingford — circular mirrors and banquettes",
  },
];

const ADVANCE_EVERY_MS = 5200;

/**
 * Three rooms, three years, crossfading.
 *
 * The years are the navigation — no dots, no arrows. Each image sits stacked
 * and fades rather than sliding, so the rooms dissolve into each other the
 * way a memory would.
 */
export function StoryHero() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = setInterval(
      () => setActive((current) => (current + 1) % STOPS.length),
      ADVANCE_EVERY_MS
    );

    return () => clearInterval(timer);
  }, [paused]);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="The Sweet1ne rooms"
      className="relative grid min-h-[100svh] items-end overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* All three stacked; only one is opaque at a time. */}
      <div className="absolute inset-0">
        {STOPS.map((stop, i) => (
          <figure
            key={stop.year}
            className={`absolute inset-0 m-0 transition-opacity duration-[1100ms] ease-in-out motion-reduce:transition-none ${
              i === active ? "z-[1] opacity-100" : "opacity-0"
            }`}
          >
            <Image
              src={stop.image}
              alt={stop.alt}
              fill
              // Only the first is priority — the others load as they're
              // needed rather than competing with it.
              priority={i === 0}
              sizes="100vw"
              className="object-cover"
            />
          </figure>
        ))}
      </div>

      {/* A gentler veil than the homepage's — these rooms are the point, so
          they stay lighter. */}
      <div
        className="pointer-events-none absolute inset-0 z-[2]"
        style={{
          background:
            "linear-gradient(to top, #0e0e0e 0%, rgba(14,14,14,.25) 45%, rgba(14,14,14,.4) 100%)",
        }}
      />

      <div className="relative z-[3] max-w-[44rem] px-[1.15rem] pb-14 sm:px-6">
        <p className="mb-3 text-[0.72rem] uppercase tracking-[0.2em] text-[var(--gold)]">
          Always in the mood for you
        </p>

        <h1 className="mb-3.5 font-display text-[clamp(2.4rem,7vw,4.8rem)] font-medium leading-[1.04]">
          Same kitchen. The rooms grew.
        </h1>

        <p className="mb-7 max-w-[30rem] text-[var(--ivory-dim)]">
          A small table in Fairlop. A lounge in Lewisham. Home again in
          Chingford.
        </p>

        <div role="tablist" className="flex flex-wrap gap-1.5">
          {STOPS.map((stop, i) => {
            const isActive = i === active;

            return (
              <button
                key={stop.year}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActive(i)}
                className={`cursor-pointer border bg-transparent px-[0.9rem] pb-[0.6rem] pt-[0.55rem] text-left transition-colors duration-500 ${
                  isActive ? "border-[var(--gold)]" : "border-transparent"
                }`}
              >
                <b
                  className={`block font-display text-[1.25rem] font-medium transition-colors duration-500 ${
                    isActive ? "text-[var(--gold)]" : "text-[rgba(229,226,225,.45)]"
                  }`}
                >
                  {stop.year}
                </b>
                <span className="text-[0.68rem] uppercase tracking-[0.14em] text-[var(--ivory-dim)]">
                  {stop.place}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}