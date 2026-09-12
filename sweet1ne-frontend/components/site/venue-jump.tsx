"use client";

import { useEffect, useRef, useState } from "react";
import { VENUES } from "@/lib/venues";

/**
 * Sticky bar tracking which restaurant you're reading.
 *
 * The scroll offset is measured at runtime rather than fixed, because the
 * header and this bar are different heights on a phone.
 */
export function VenueJump() {
  const [current, setCurrent] = useState(VENUES[0].id);
  const barRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          // Only ids that are actually venues — resolving rather than
          // casting, so the DOM can't feed the state something it isn't.
          const venue = VENUES.find((v) => v.id === entry.target.id);
          if (venue) setCurrent(venue.id);
        });
      },
      { rootMargin: "-40% 0px -45% 0px", threshold: 0.15 }
    );

    VENUES.forEach((venue) => {
      const el = document.getElementById(venue.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  // Land on a hash when the page opens with one — the homepage films link
  // here with #lewisham and #chingford.
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    const venue = VENUES.find((v) => v.id === hash);
    if (!venue || !document.getElementById(hash)) return;

    setCurrent(venue.id);
    // Twice, because the first attempt can fire before images have settled
    // the layout.
    requestAnimationFrame(() => requestAnimationFrame(() => jumpTo(hash, false)));
  }, []);

  function jumpTo(id: string, smooth = true) {
    const el = document.getElementById(id);
    if (!el) return;

    const header = document.querySelector("header");
    const offset = (header?.offsetHeight ?? 0) + (barRef.current?.offsetHeight ?? 0);

    const y = el.getBoundingClientRect().top + window.scrollY - offset;

    window.scrollTo({
      top: Math.max(0, y),
      behavior:
        smooth && !window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "smooth"
          : "auto",
    });

    history.replaceState(null, "", `#${id}`);
  }

  return (
    <nav
      ref={barRef}
      aria-label="Restaurants"
      className="sticky top-[3.7rem] z-30 grid w-full grid-cols-2 border-b border-[rgba(201,162,74,.14)] bg-[rgba(5,5,5,.96)] sm:top-[4.15rem]"
    >
      {VENUES.map((venue) => {
        const isOn = current === venue.id;

        return (
          <button
            key={venue.id}
            type="button"
            onClick={() => jumpTo(venue.id)}
            aria-current={isOn ? "location" : undefined}
            className={`min-w-0 px-[0.4rem] py-[0.95rem] text-center text-[0.68rem] uppercase tracking-[0.14em] transition-colors sm:py-[0.85rem] ${
              isOn
                ? "text-[var(--gold)] shadow-[inset_0_-2px_0_var(--gold)]"
                : "text-[var(--ivory-dim)] hover:text-[var(--ivory)]"
            }`}
          >
            {venue.name}
          </button>
        );
      })}
    </nav>
  );
}