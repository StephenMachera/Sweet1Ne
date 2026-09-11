import Link from "next/link";

/**
 * The idea behind the food, before the journey through the rooms.
 *
 * Washed background rather than presented photography — at 16% opacity it's
 * texture, which is what lets centred type sit on top without a scrim.
 */
export function StoryOrigin() {
  return (
    <section
      id="origin"
      aria-label="Elevated Afro-Fusion — the journey"
      className="relative isolate w-full max-w-full overflow-hidden p-0"
    >
      {/* Extended past the section's bounds so the gradient reaches black
          before the edge rather than at it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -bottom-[20%] -top-[10%] z-0 bg-cover bg-no-repeat"
        style={{
          backgroundImage: "url('/images/homepage-gallery/story/01-the-kitchen.jpg')",
          backgroundPosition: "center 48%",
          opacity: 0.16,
          filter: "saturate(0.7)",
        }}
      >
        <span
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 50% 50% at 50% 40%, rgba(201, 162, 74, 0.12), transparent 68%), linear-gradient(to bottom, #0e0e0e 0%, rgba(14,14,14,.55) 40%, rgba(14,14,14,.72) 72%, #0e0e0e 100%)",
          }}
        />
      </div>

      <div className="relative z-[2] mx-auto w-full max-w-[min(44rem,100%)] px-[1.15rem] pb-16 pt-[4.75rem] text-center sm:px-6 sm:pb-[5.5rem] sm:pt-[6.5rem]">
        <p className="mb-3 text-[0.72rem] uppercase tracking-[0.2em] text-[var(--gold)]">
          Afro-Caribbean fusion
        </p>

        <h2 className="mb-5 font-display text-[clamp(2rem,9vw,2.6rem)] font-medium leading-[1.08] [overflow-wrap:break-word] sm:text-[clamp(2.4rem,5.5vw,3.8rem)]">
          Elevated{" "}
          {/* Its own line on mobile, where the phrase would otherwise wrap
              somewhere unhelpful. */}
          <span className="block sm:inline">Afro-Fusion.</span>
        </h2>

        <p className="mx-auto mb-6 max-w-[22rem] text-[1.08rem] leading-[1.55] text-[var(--ivory)] sm:mb-7 sm:max-w-[38rem] sm:text-[clamp(1.12rem,2.1vw,1.35rem)] sm:leading-relaxed">
          Sweet1ne was built from a passion for Afro-Caribbean food — the best
          of African and Caribbean dishes, with the indulgence of soul food. Not
          fusion for show. A kitchen that already knew how those tables talk to
          each other.
        </p>

        {/* The years double as navigation into the beats below. */}
        <ol className="m-0 flex list-none flex-wrap justify-center gap-x-8 gap-y-[1.4rem] p-0">
          {[
            { year: "2019", place: "Fairlop", href: "#fairlop" },
            { year: "2023", place: "Lewisham", href: "#lewisham" },
            { year: "2025", place: "Chingford", href: "#chingford" },
          ].map((stop) => (
            <li key={stop.year}>
              <Link
                href={stop.href}
                className="group text-[0.72rem] uppercase tracking-[0.12em] text-[var(--ivory-dim)] transition-colors hover:text-[var(--ivory)]"
              >
                <b className="block font-display text-[1.15rem] font-medium normal-case leading-[1.15] tracking-normal text-[var(--gold)]">
                  {stop.year}
                </b>
                {stop.place}
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}