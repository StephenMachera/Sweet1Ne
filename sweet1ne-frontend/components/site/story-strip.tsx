import Image from "next/image";
import Link from "next/link";
import { Eyebrow, Heading } from "./section";
import { MaskReveal } from "./motion/mask-reveal";
import { Parallax } from "./motion/parallax";

/**
 * The room, and why it exists.
 *
 * One wide interior shot rather than a grid — the food sells the trip, the
 * room sells the occasion. Someone planning a birthday needs to see what it
 * looks like full.
 */
export function StoryStrip() {
  return (
    <section className="relative z-10">
      {/* Full-bleed interior — no container, no rounded corners. The mask
          uncovers it as it enters; the parallax gives it depth. */}
      <MaskReveal className="relative aspect-[4/5] w-full overflow-hidden sm:aspect-[21/9]">
        <div className="absolute inset-0">
          <Parallax className="absolute inset-0 h-[115%]" amount={0.08}>
            <Image
              src="/images/interiors/room-full.jpg"
              alt="The dining room at Sweet1NE on a Saturday night"
              fill
              sizes="100vw"
              className="object-cover"
            />
          </Parallax>

          <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e] via-transparent to-[#0e0e0e]/40" />

          <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[1440px] px-5 pb-10 sm:px-8 sm:pb-16 lg:px-12">
            <p className="label-caps text-[var(--gold)]">Saturday, 9pm</p>
            <p className="mt-4 max-w-xl font-display text-[clamp(1.5rem,3.5vw,2.5rem)] leading-tight">
              Birthdays, first dates, and six people fighting over the last lamb
              chop.
            </p>
          </div>
        </div>
      </MaskReveal>

      {/* The story, briefly — the full version lives on its own page. */}
      <div className="mx-auto max-w-[1440px] px-5 py-12 sm:px-8 sm:py-20 lg:px-12">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-20">
          <div>
            <Eyebrow>Our story</Eyebrow>
            <Heading accent="London built.">Black-owned.</Heading>
          </div>

          <div className="lg:pt-4">
            <p className="text-lg leading-relaxed text-[var(--ivory-dim)]">
              Sweet1NE started with a simple idea — that the food people grew up
              eating deserved a room worth eating it in. Afro-Caribbean cooking,
              soul food technique, and the kind of night out you plan a week
              ahead.
            </p>
            <p className="mt-5 text-lg leading-relaxed text-[var(--ivory-dim)]">
              Everything on the menu is Halal. Everything on the menu is meant to
              be shared.
            </p>

            <Link
              href="/story"
              className="mt-8 inline-block border-b border-[var(--ivory)]/30 pb-1 text-sm transition-colors hover:border-[var(--gold)] hover:text-[var(--gold)]"
            >
              Read the full story
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}