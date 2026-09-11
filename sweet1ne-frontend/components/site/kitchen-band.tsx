import Link from "next/link";

/**
 * A quiet band between the emblems and the locations.
 *
 * The background image is heavily washed back rather than presented — at 20%
 * opacity with the saturation pulled down, it reads as texture rather than
 * photography, which is what lets the type sit centred on top of it.
 */
export function KitchenBand() {
  return (
    <section
      id="kitchen"
      className="relative isolate overflow-hidden text-center"
    >
      {/* The wash. Extended past the section's bounds top and bottom so the
          gradient fades to black before the edge rather than at it. */}
      <div
        aria-hidden
        className="absolute inset-x-0 -bottom-[20%] -top-[12%] -z-10 bg-cover bg-no-repeat"
        style={{
          backgroundImage: "url('/images/homepage-gallery/story/hero-lewisham-a.jpg')",
          backgroundPosition: "center 48%",
          opacity: 0.2,
          filter: "saturate(0.78)",
        }}
      >
        {/* A warm bloom behind the type, and a vertical fade to black at
            both ends so the band has no hard edges. */}
        <span
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 48% 50% at 50% 42%, rgba(201,162,74,.11), transparent 70%), linear-gradient(to bottom, #0e0e0e 0%, rgba(14,14,14,.5) 42%, #0e0e0e 100%)",
          }}
        />
      </div>

      <div className="relative z-[2] mx-auto max-w-[min(40rem,100%)] px-5 py-[4.75rem] sm:px-6 sm:py-[6.25rem] sm:pb-[5.75rem]">
        <p className="mb-3 text-[0.64rem] uppercase tracking-[0.12em] text-[var(--gold)] sm:text-[0.72rem] sm:tracking-[0.2em]">
          Afro-Caribbean fusion
        </p>

        <h2 className="mb-5 font-display text-[clamp(2.4rem,5.5vw,3.8rem)] font-medium leading-[1.08]">
          Elevated{" "}
          {/* Breaks onto its own line on mobile, where the full phrase
              would otherwise wrap awkwardly mid-word. */}
          <span className="block sm:inline">Afro-Fusion.</span>
        </h2>

        <p className="mx-auto mb-6 max-w-[36rem] text-[1.08rem] leading-[1.55] text-[var(--ivory)] sm:text-[clamp(1.1rem,2vw,1.32rem)] sm:leading-relaxed">
          African and Caribbean dishes, with the indulgence of soul food. Not
          fusion for show. A table for the people you actually want to eat with.
        </p>

        <Link
          href="/story"
          className="inline-block border-b border-[rgba(201,162,74,.55)] pb-0.5 text-[0.85rem] text-[var(--ivory)] transition-colors hover:border-[var(--gold)] hover:text-[var(--gold)]"
        >
          Our story
        </Link>
      </div>
    </section>
  );
}