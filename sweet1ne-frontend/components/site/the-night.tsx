"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { openBookingModal } from "./booking-modal";
import { gsap } from "gsap";

type Panel = {
  id: string;
  label: string;
  kicker: string;
  heading: string;
  body: string;
  image: string;
  /** Where the subject sits in the frame — the discs crop hard, so a
   *  centred default loses the point of some shots. */
  objectPosition: string;
};

const PANELS: Panel[] = [
  {
    id: "kitchen",
    label: "The kitchen",
    kicker: "The kitchen",
    heading: "A blend of flavour and culture.",
    body: "African and Caribbean dishes, with the indulgence of soul food. Not fusion for show. A palate that knows what it's doing.",
    image: "/images/homepage-gallery/interiors/emblem-food.jpg",
    objectPosition: "50% 48%",
  },
  {
    id: "celebrations",
    label: "Celebrations",
    kicker: "Celebrations",
    heading: "Tell us what you're marking.",
    body: "Birthdays — or none of those. Add a note when you book. We'll have the candles ready.",
    image: "/images/homepage-gallery/interiors/celebrations-guests.jpg",
    objectPosition: "50% 32%",
  },
  {
    id: "bar",
    label: "The bar",
    kicker: "The bar",
    heading: "A proper bar for the table.",
    body: "Cocktails, wine, something without alcohol if you'd rather. Whatever the night calls for.",
    image: "/images/homepage-gallery/interiors/emblem-drinks.jpg",
    objectPosition: "50% 48%",
  },
];

/**
 * Three positions, and the emblems rotate between them.
 *
 * Each disc's slot is its distance from the active one, so clicking any
 * emblem moves it into the large position and pushes the others round. That
 * shared movement is what makes it read as one mechanism rather than three
 * buttons — and it's why the slots are positions, not identities.
 */

// left, top and width per slot. Slot 0 is the large one.
const SLOTS = {
  desktop: [
    { left: "2%", top: "8%", width: "21.5rem", z: 3 },
    { left: "62%", top: "0", width: "11.2rem", z: 2 },
    { left: "54%", top: "52%", width: "13.4rem", z: 1 },
  ],
  mobile: [
    { left: "0", top: "1.4rem", width: "11.8rem", z: 3 },
    { left: "58%", top: "0", width: "6.6rem", z: 2 },
    { left: "52%", top: "10.6rem", width: "7.6rem", z: 1 },
  ],
};

const ROTATE_EVERY_MS = 5200;

export function TheNight() {
  const [active, setActive] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [paused, setPaused] = useState(false);
  const copyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 720px)");
    const update = () => setIsMobile(query.matches);

    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // Auto-advance, pausing while someone's looking at it.
  useEffect(() => {
    if (paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = setInterval(
      () => setActive((current) => (current + 1) % PANELS.length),
      ROTATE_EVERY_MS
    );

    return () => clearInterval(timer);
  }, [paused]);

  // The copy fades in rather than swapping, so switching feels like turning
  // to look at something.
  useEffect(() => {
    const el = copyRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        el.querySelectorAll(".night-line"),
        { y: 16, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.55, stagger: 0.07, ease: "power3.out" }
      );
    }, el);

    return () => ctx.revert();
  }, [active]);

  const slots = isMobile ? SLOTS.mobile : SLOTS.desktop;
  const panel = PANELS[active];

  return (
    <section
      id="the-kitchen"
      aria-label="The kitchen"
      className="mx-auto max-w-[1180px] px-5 py-9 sm:px-6 sm:py-14 lg:grid lg:grid-cols-[1.12fr_0.88fr] lg:items-center lg:gap-10"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* The stage */}
      <div
        role="tablist"
        aria-label="The restaurant"
        className="relative mb-8 min-h-[22.5rem] sm:min-h-[28rem] lg:mb-0 lg:min-h-[32rem]"
      >
        {PANELS.map((item, i) => {
          // Distance from the active emblem decides which position it takes.
          const slotIndex = (i - active + PANELS.length) % PANELS.length;
          const slot = slots[slotIndex];
          const isActive = i === active;

          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(i)}
              className="absolute cursor-pointer border-0 bg-transparent p-0 text-center transition-[left,top,width] duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
              style={{
                left: slot.left,
                top: slot.top,
                width: slot.width,
                zIndex: slot.z,
              }}
            >
              <span
                className="relative block aspect-square w-full overflow-hidden rounded-full transition-shadow duration-500"
                style={{
                  // A hairline ring, then a thick dark one that separates
                  // overlapping discs from each other.
                  boxShadow: isActive
                    ? "0 0 0 2px var(--gold), 0 0 0 9px rgba(14,14,14,.94)"
                    : "0 0 0 1px rgba(201,162,74,.28), 0 0 0 8px rgba(14,14,14,.92)",
                }}
              >
                <Image
                  src={item.image}
                  alt=""
                  fill
                  sizes="(max-width: 720px) 190px, 350px"
                  className="object-cover"
                  style={{ objectPosition: item.objectPosition }}
                />
              </span>

              <span
                className={`mt-2.5 block text-[0.62rem] uppercase tracking-[0.16em] transition-colors duration-500 ${
                  isActive ? "text-[var(--gold)]" : "text-[var(--ivory-dim)]"
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* The copy. A minimum height stops the page shifting as the heading
          changes length. */}
      <div
        ref={copyRef}
        className="relative z-[2] w-full min-w-0 max-w-[22rem] sm:max-w-[34rem]"
      >
        <div className="min-h-[13rem] sm:min-h-[12rem]">
          <p className="night-line mb-3 text-[0.72rem] uppercase tracking-[0.2em] text-[var(--gold)]">
            {panel.kicker}
          </p>

          <h2 className="night-line mb-3.5 font-display text-[clamp(1.75rem,4vw,3.1rem)] font-medium leading-[1.12] [overflow-wrap:break-word]">
            {panel.heading}
          </h2>

          <p className="night-line leading-relaxed text-[var(--ivory-dim)] [overflow-wrap:break-word]">
            {panel.body}
          </p>
        </div>

        <p className="mt-6">
          <button
            type="button"
            onClick={openBookingModal}
            className="inline-block bg-[var(--gold)] px-5 py-3 text-[0.82rem] font-semibold text-[#0e0e0e] transition-colors hover:opacity-90"
            style={{ borderRadius: "4px" }}
          >
            Book a table
          </button>
        </p>
      </div>
    </section>
  );
}