"use client";

import Link from "next/link";
import { openBookingModal } from "./booking-modal";

/**
 * Shorter than the homepage hero — someone clicking "Menu" wants the food,
 * so this sets the scene without holding them up.
 *
 * The ring on the right is drawn rather than photographed: a hairline
 * circle with two soft outer glows, echoing the emblems below without
 * needing another image.
 */
export function MenuHero() {
  return (
    <section className="relative isolate grid min-h-[72svh] items-end sm:min-h-[78svh]">
      {/* The wash sits behind everything at -z-10, with its own gradient
          layered on top. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-cover bg-no-repeat"
        style={{
          backgroundImage: "url('/images/homepage-gallery/menu/photo-kitchen.jpg')",
          backgroundPosition: "center 40%",
        }}
      >
        <span
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, #0e0e0e 0%, rgba(14,14,14,.45) 48%, rgba(14,14,14,.55) 100%), radial-gradient(ellipse 50% 50% at 70% 40%, rgba(201,162,74,.16), transparent 70%)",
          }}
        />
      </div>

      {/* A drawn ring, not an image — the two outer box-shadows give it a
          soft halo that would be hard to achieve any other way. */}
      <span
        aria-hidden
        className="pointer-events-none absolute right-[-1.5rem] top-[8%] z-0 aspect-square w-36 rounded-full border border-[rgba(201,162,74,.28)] sm:right-[6%] sm:top-[14%] sm:w-[min(42vw,22rem)]"
        style={{
          boxShadow: "0 0 0 14px rgba(201,162,74,.06)",
        }}
      />

      <div className="relative z-[1] max-w-[40rem] px-[1.15rem] pb-6 sm:px-6 sm:pb-12">
        <p className="mb-3 text-[0.72rem] uppercase tracking-[0.2em] text-[var(--gold)]">
          Lewisham · Chingford
        </p>

        <h1 className="mb-3.5 font-display text-[clamp(2.1rem,11vw,2.6rem)] font-medium leading-[1.04] sm:text-[clamp(2.6rem,7vw,4.6rem)]">
          The table.
        </h1>

        <p className="mb-6 max-w-[28rem] text-[var(--ivory-dim)]">
          Elevated Afro-Fusion. African and Caribbean dishes, with the
          indulgence of soul food. Same kitchen. Your night.
        </p>

        <div className="flex flex-wrap items-center gap-x-[1.2rem] gap-y-[0.8rem]">
          <button
            type="button"
            onClick={openBookingModal}
            className="bg-[var(--gold)] px-[0.9rem] py-[0.58rem] text-[0.75rem] font-semibold text-[#0e0e0e] transition-opacity hover:opacity-90 sm:px-[1.2rem] sm:py-[0.7rem] sm:text-[0.82rem]"
            style={{ borderRadius: "4px" }}
          >
            Book a table
          </button>

          <Link
            href="#starters"
            className="border-b border-[rgba(201,162,74,.55)] pb-[0.12rem] text-[0.85rem] text-[var(--ivory)] transition-colors hover:border-[var(--gold)] hover:text-[var(--gold)]"
          >
            Start with the kitchen
          </Link>
        </div>
      </div>
    </section>
  );
}