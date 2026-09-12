"use client";

import { useEffect, useRef, useState } from "react";

const STOPS = [
  { id: "fairlop", label: "2019 · Fairlop" },
  { id: "lewisham", label: "2023 · Lewisham" },
  { id: "chingford", label: "2025 · Chingford" },
];

/**
 * The journey, as a sticky bar.
 *
 * The scroll offset is measured at runtime rather than fixed — the header is
 * a different height on a phone, and a fixed scroll-margin would land wrong
 * on one or the other.
 */
export function StoryJump() {
  const [current, setCurrent] = useState(STOPS[0].id);
  const barRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setCurrent(entry.target.id);
        });
      },
      { rootMargin: "-40% 0px -45% 0px", threshold: 0.15 }
    );

    STOPS.forEach((stop) => {
      const el = document.getElementById(stop.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  // Land on a hash when the page opens with one — twice, because the first
  // attempt can fire before images have settled the layout.
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash || !document.getElementById(hash)) return;

    setCurrent(hash);
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
      aria-label="The journey"
      className="sticky top-[3.7rem] z-30 flex gap-[1.15rem] overflow-x-auto border-b border-[rgba(201,162,74,.14)] bg-[#050505] px-[1.15rem] py-[0.7rem] sm:top-[4.15rem] sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {STOPS.map((stop) => {
        const isOn = current === stop.id;

        return (
          <button
            key={stop.id}
            type="button"
            onClick={() => jumpTo(stop.id)}
            aria-current={isOn ? "location" : undefined}
            className={`shrink-0 whitespace-nowrap text-[0.68rem] uppercase tracking-[0.16em] transition-colors ${
              isOn
                ? "text-[var(--gold)]"
                : "text-[var(--ivory-dim)] hover:text-[var(--ivory)]"
            }`}
          >
            {stop.label}
          </button>
        );
      })}
    </nav>
  );
}