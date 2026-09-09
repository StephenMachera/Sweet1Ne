import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Eyebrow, Heading } from "@/components/site/section";
import { MaskReveal } from "@/components/site/motion/mask-reveal";
import { SplitReveal } from "@/components/site/motion/split-reveal";
import { StoryHeroVideo } from "@/components/site/story-hero-video";
import { BookTableButton } from "@/components/site/booking-modal";

export const metadata: Metadata = {
  title: "Our Story",
  description:
    "From a small takeaway in Fairlop to two London restaurants — Afro-Caribbean cuisine enriched by American soul food heritage.",
};

/**
 * Three moments across five years. The copy already has the shape of a
 * timeline, so the page is built as one — each chapter alternating side to
 * side, with a gold rule connecting them down the page.
 */
const CHAPTERS = [
  {
    year: "2020",
    place: "Fairlop, Ilford",
    title: "Where it started",
    body: "A small restaurant and takeaway, and a bold idea — Afro-Caribbean cuisine enriched by the heritage of American soul food. No fusion for its own sake. Two traditions that already understood each other.",
    image: "/images/story/fairlop.jpg",
  },
  {
    year: "2023",
    place: "Lewisham",
    title: "A room of our own",
    body: "Three years of building a following, and the food had outgrown the space. Lewisham gave it somewhere to sit properly — a more refined expression of the same craft, in a room designed for the night out people were already making of it.",
    image: "/images/story/lewisham.jpg",
  },
  {
    year: "2025",
    place: "Chingford",
    title: "Coming home",
    body: "Two years later, back to East London. A natural homecoming, and a continued celebration of culture and flavour — the same kitchen, the same standards, closer to where it began.",
    image: "/images/story/chingford.jpg",
  },
];

export default function StoryPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative flex min-h-[70svh] items-end overflow-hidden pt-32">
        <StoryHeroVideo />

        <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e] via-[#0e0e0e]/50 to-[#0e0e0e]/60" />
        <div className="glow left-[15%] top-1/4 h-[400px] w-[400px]" />

        <div className="relative mx-auto w-full max-w-[1440px] px-5 pb-16 sm:px-8 sm:pb-24 lg:px-12">
          <Eyebrow>Est. 2020 · London</Eyebrow>
          <SplitReveal
            as="h1"
            className="max-w-3xl font-display text-[clamp(2.5rem,7vw,5rem)] leading-[0.95] tracking-[-0.02em]"
          >
            {"Heritage\nwith flavour."}
          </SplitReveal>
        </div>
      </section>

      {/* The timeline */}
      <section className="relative mx-auto max-w-[1440px] px-5 py-20 sm:px-8 sm:py-32 lg:px-12">
        {/* The thread running down the page — hidden on mobile, where the
            chapters stack and the connection is obvious anyway. */}
        <div className="absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-[var(--hairline)] to-transparent lg:block" />

        <div className="space-y-24 sm:space-y-32">
          {CHAPTERS.map((chapter, i) => {
            const flipped = i % 2 === 1;

            return (
              <article
                key={chapter.year}
                className="relative grid items-center gap-8 lg:grid-cols-2 lg:gap-20"
              >
                {/* The year, marking the thread. */}
                <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 lg:block">
                  <span
                    className="label-caps border border-[var(--hairline)] bg-[#0e0e0e] px-3 py-2 text-[var(--gold)]"
                    style={{ borderRadius: "4px" }}
                  >
                    {chapter.year}
                  </span>
                </div>

                <MaskReveal
                  className={`relative aspect-[4/3] overflow-hidden ${
                    flipped ? "lg:order-2 lg:pl-16" : "lg:pr-16"
                  }`}
                  direction={flipped ? "left" : "up"}
                >
                  <div className="absolute inset-0">
                    <Image
                      src={chapter.image}
                      alt={`Sweet1NE ${chapter.place}`}
                      fill
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      className="object-cover"
                    />
                  </div>
                </MaskReveal>

                <div className={flipped ? "lg:order-1 lg:pr-16 lg:text-right" : "lg:pl-16"}>
                  {/* Year again on mobile, where the thread marker is hidden. */}
                  <p className="label-caps text-[var(--gold)] lg:hidden">
                    {chapter.year} · {chapter.place}
                  </p>
                  <p className="label-caps hidden text-[var(--gold)] lg:block">
                    {chapter.place}
                  </p>

                  <h2 className="mt-4 font-display text-[clamp(1.75rem,4vw,2.75rem)] leading-tight">
                    {chapter.title}
                  </h2>

                  <p className="mt-5 text-lg leading-relaxed text-[var(--ivory-dim)]">
                    {chapter.body}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* What holds it together */}
      <section className="border-y border-[var(--hairline-faint)] bg-[#131313]">
        <div className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr] lg:gap-20">
            <div>
              <Eyebrow>What hasn't changed</Eyebrow>
              <Heading accent="every table.">The same food,</Heading>
            </div>

            <div className="space-y-8">
              <div className="border-l border-[var(--hairline)] pl-6">
                <p className="label-caps text-[var(--gold)]">100% Halal</p>
                <p className="mt-2 leading-relaxed text-[var(--ivory-dim)]">
                  Every dish, every branch, since the beginning. Not a section of
                  the menu — the whole thing.
                </p>
              </div>

              <div className="border-l border-[var(--hairline)] pl-6">
                <p className="label-caps text-[var(--gold)]">Built for sharing</p>
                <p className="mt-2 leading-relaxed text-[var(--ivory-dim)]">
                  Seafood boils poured onto the table. Platters that need four
                  people and everyone's hands. Food is better when it's an event.
                </p>
              </div>

              <div className="border-l border-[var(--hairline)] pl-6">
                <p className="label-caps text-[var(--gold)]">Black-owned, London built</p>
                <p className="mt-2 leading-relaxed text-[var(--ivory-dim)]">
                  Started here, grown here, still here. Two rooms in the city that
                  made it.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Close */}
      <section className="mx-auto max-w-[1440px] px-5 py-20 text-center sm:px-8 sm:py-28 lg:px-12">
        <Heading accent="the next chapter.">Come and be part of</Heading>

        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <BookTableButton
            className="bg-[var(--gold)] px-8 py-4 text-sm font-semibold text-[#0e0e0e] hover:bg-[var(--gold-deep)]"
            style={{ borderRadius: "4px" }}
          >
            Book a table
          </BookTableButton>
          <Link
            href="/menu"
            className="border border-[var(--ivory)]/40 px-8 py-4 text-sm font-semibold hover:border-[var(--gold)] hover:text-[var(--gold)]"
            style={{ borderRadius: "4px" }}
          >
            See the menu
          </Link>
        </div>
      </section>
    </>
  );
}