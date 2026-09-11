"use client";

import { openBookingModal } from "./booking-modal";

/**
 * The closing invitation, over a washed map of the journey.
 *
 * Centred and quiet — the story has been told by this point, so this just
 * gathers it into one line and asks.
 */
export function StoryMood() {
  return (
    <section
      id="mood"
      className="relative isolate overflow-hidden px-[1.15rem] pb-24 pt-[5.5rem] text-center sm:px-6 sm:pb-24"
    >
      <div
        aria-hidden
        className="absolute inset-x-0 -bottom-[20%] -top-[10%] -z-10 bg-cover bg-no-repeat"
        style={{
          backgroundImage: "url('/images/homepage-gallery/story/journey-map.jpg')",
          backgroundPosition: "center 42%",
          opacity: 0.22,
          filter: "saturate(0.85)",
        }}
      >
        <span
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, #0e0e0e 0%, rgba(14,14,14,.55) 35%, rgba(14,14,14,.7) 70%, #0e0e0e 100%)",
          }}
        />
      </div>

      <p className="mb-3 text-[0.72rem] uppercase tracking-[0.2em] text-[var(--gold)]">
        The invitation
      </p>

      <h2 className="mb-4 font-display text-[clamp(2.3rem,5.5vw,3.8rem)] font-medium leading-[1.08]">
        Always in the mood for you.
      </h2>

      <p className="mx-auto mb-9 max-w-[32rem] text-[var(--ivory-dim)]">
        Fairlop was a small table. Lewisham gave it a lounge. Chingford gave it
        another. The cooking stayed. Come sit.
      </p>

      <button
        type="button"
        onClick={openBookingModal}
        className="inline-block bg-[var(--gold)] px-[1.6rem] py-[0.95rem] text-[0.85rem] font-semibold text-[#0e0e0e] transition-opacity hover:opacity-90"
        style={{ borderRadius: "4px" }}
      >
        Book a table
      </button>
    </section>
  );
}