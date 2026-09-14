"use client";

import Link from "next/link";
import { openBookingModal } from "./booking-modal";

/**
 * The introduction, in a bordered panel.
 *
 * The frame is three rules rather than one — a gold hairline, a dark gap,
 * then a fainter gold line inside it. Set with inset shadows rather than
 * nested elements, which is the only way to get that without extra markup.
 */
export function House() {
  return (
    <section
      className="relative z-[8] mx-4 mb-[1.6rem] border border-[rgba(201,162,74,.42)] px-[1.15rem] pb-[1.85rem] pt-[1.2rem] text-center sm:mx-auto sm:mb-8 sm:max-w-[40rem] sm:px-6 sm:pb-[2.2rem] sm:pt-[1.4rem]"
      style={{
        boxShadow:
          "inset 0 0 0 6px #050505, inset 0 0 0 7px rgba(201,162,74,.22)",
      }}
    >
      {/* Body face rather than display — this is the plain-spoken half, and
          the serif would make it read as a pull quote. */}
      <p className="mx-auto mb-[1.05rem] max-w-[32rem] font-body text-[0.95rem] leading-[1.55] text-[var(--ivory-dim)]">
        Our journey began with a passion for bringing people together over
        dishes that resonate with history, culture and heart.
      </p>

      <p className="mx-auto mb-[1.65rem] max-w-[32rem] text-[0.95rem] leading-relaxed text-[var(--ivory-dim)]">
        We reimagine the flavours of African, Caribbean and American soul food
        honouring generations of culinary wisdom, then elevating every recipe
        into a modern dining experience. At the centre of the kitchen is
        uncompromised craft: sea-fresh catches, sun-ripened spices, every plate
        telling a story. A feast for all five senses. Sweet1NE is a celebration
        of flavour, tradition and togetherness.
      </p>

      <div className="flex flex-wrap justify-center gap-x-[0.9rem] gap-y-3">
        <Link
          href="/menu"
          className="border border-[rgba(201,162,74,.9)] px-[1.05rem] py-[0.58rem] text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[var(--gold)] transition-colors hover:bg-[var(--gold)] hover:text-[#0e0e0e]"
          style={{ borderRadius: "3px" }}
        >
          The menu
        </Link>

        <button
          type="button"
          onClick={openBookingModal}
          className="border border-[rgba(201,162,74,.9)] px-[1.05rem] py-[0.58rem] text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[var(--gold)] transition-colors hover:bg-[var(--gold)] hover:text-[#0e0e0e]"
          style={{ borderRadius: "3px" }}
        >
          Book a table
        </button>
      </div>
    </section>
  );
}