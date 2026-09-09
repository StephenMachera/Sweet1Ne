"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Eyebrow } from "./section";
import { SplitReveal } from "./motion/split-reveal";
import { openBookingModal } from "./booking-modal";

gsap.registerPlugin(ScrollTrigger);

/**
 * The room, assembling.
 *
 * Fragments fly in from alternating edges, each bringing a line of text a
 * beat behind. The copy carries the weight here — a caption that just labels
 * a photograph makes the section an album; a line with something to say
 * makes it a story.
 */

type Fragment = {
  src: string;
  alt: string;
  from: "left" | "right";
  distance: number;
  drift: number;
  /** Small caps line above — sets the scene rather than describing it. */
  eyebrow?: string;
  /** The line itself, in display serif, large. */
  headline?: string;
  /** One sentence beneath, in body sans. Optional. */
  body?: string;
  className: string;
};

const FRAGMENTS: Fragment[] = [
  {
    src: "/images/interiors/room-1.webp",
    alt: "The dining room, set for service",
    from: "left",
    distance: 0.5,
    drift: 0.04,
    eyebrow: "8pm",
    headline: "Every table is full and nobody is quiet.",
    body: "There's a sound a busy room makes. We've never wanted to turn it down.",
    className: "aspect-[5/4] w-[68%] lg:w-[44%]",
  },
  {
    src: "/images/interiors/room-2.webp",
    alt: "Tables set for dinner near the bar",
    from: "right",
    distance: 0.6,
    drift: 0.14,
    eyebrow: "Most nights",
    headline: "Somebody is turning something.",
    body: "Twenty-one, thirty, forty. The candles come out more often than you'd think.",
    className: "aspect-[3/4] ml-auto w-[52%] lg:w-[26%] lg:-mt-28",
  },
  {
    src: "/images/interiors/room-3.webp",
    alt: "A corner booth in the dining room",
    from: "left",
    distance: 0.45,
    drift: 0.1,
    eyebrow: "The bar",
    headline: "Everything is Halal. Nothing tastes like a compromise.",
    className: "aspect-square w-[44%] lg:w-[21%] lg:ml-[12%] lg:-mt-14",
  },
  {
    src: "/images/interiors/room-4.webp",
    alt: "A table set beneath the cherry blossom display",
    from: "right",
    distance: 0.55,
    drift: 0.16,
    eyebrow: "Two hours",
    headline: "Long enough for a proper meal. Short enough that everyone gets one.",
    body: "We turn tables because the alternative is turning people away.",
    className: "aspect-[4/5] ml-auto w-[56%] lg:w-[27%] lg:mr-[6%] lg:-mt-44",
  },
  {
    src: "/images/interiors/room-5.webp",
    alt: "The dining room, wide view",
    from: "left",
    distance: 0.5,
    drift: 0.06,
    eyebrow: "From everywhere",
    headline: "People come across London for a table here.",
    body: "Which still surprises us, five years in.",
    className: "aspect-[16/9] w-[76%] lg:w-[40%] lg:ml-[20%] lg:-mt-24",
  },
];

export function TheRoom() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".room-fragment").forEach((fragment) => {
        const from = fragment.dataset.from as "left" | "right";
        const distance = Number(fragment.dataset.distance ?? 0.5);
        const drift = Number(fragment.dataset.drift ?? 0.1);

        const photo = fragment.querySelector(".room-photo");
        const lines = fragment.querySelectorAll(".room-line");

        // Entering — fast in from the edge, settling rather than gliding.
        gsap.fromTo(
          fragment,
          {
            xPercent: from === "left" ? -distance * 140 : distance * 140,
            opacity: 0,
            rotate: from === "left" ? -2 : 2,
          },
          {
            xPercent: 0,
            opacity: 1,
            rotate: 0,
            ease: "power4.out",
            scrollTrigger: {
              trigger: fragment,
              start: "top 92%",
              end: "top 55%",
              scrub: 1,
            },
          }
        );

        gsap.fromTo(
          photo,
          { filter: "blur(14px)", scale: 1.16 },
          {
            filter: "blur(0px)",
            scale: 1,
            ease: "none",
            scrollTrigger: {
              trigger: fragment,
              start: "top 92%",
              end: "top 55%",
              scrub: 1,
            },
          }
        );

        // The words follow from the same direction, staggered — so they feel
        // carried in by the image rather than sitting beside it.
        if (lines.length) {
          gsap.fromTo(
            lines,
            { x: from === "left" ? -50 : 50, opacity: 0 },
            {
              x: 0,
              opacity: 1,
              duration: 1,
              stagger: 0.12,
              ease: "power3.out",
              scrollTrigger: { trigger: fragment, start: "top 72%", once: true },
            }
          );
        }

        // Settled drift — larger images move least, which is what gives the
        // arrangement depth.
        gsap.fromTo(
          fragment,
          { yPercent: drift * 40 },
          {
            yPercent: -drift * 40,
            ease: "none",
            scrollTrigger: {
              trigger: section,
              start: "top bottom",
              end: "bottom top",
              scrub: 1.2,
            },
          }
        );
      });
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    // overflow-hidden is load-bearing — fragments start well outside their
    // final position and would otherwise scroll the page sideways.
    <section ref={sectionRef} className="relative overflow-hidden pb-16 pt-20 sm:pb-20 sm:pt-28 lg:pb-24 lg:pt-32">
      <div className="glow left-[-12%] top-1/4 h-[520px] w-[520px]" />
      <div className="glow right-[-8%] bottom-1/3 h-[400px] w-[400px] opacity-50" />

      <div className="relative mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
        <div className="mb-14 max-w-2xl lg:mb-28">
          <Eyebrow>The room</Eyebrow>
          <SplitReveal
            as="h2"
            className="font-display text-[clamp(2.25rem,6.5vw,4.5rem)] leading-[0.98] tracking-[-0.02em]"
          >
            {"You don't come here\nfor a quiet night."}
          </SplitReveal>

          <p className="mt-7 max-w-md text-lg leading-relaxed text-[var(--ivory-dim)]">
            Two rooms in London, both full most evenings, both louder than the
            photographs suggest.
          </p>
        </div>

        <div className="relative space-y-14 lg:space-y-0">
          {FRAGMENTS.map((fragment, i) => (
            <FragmentBlock key={fragment.src} fragment={fragment} index={i} />
          ))}
        </div>

        <div className="mt-14 flex flex-wrap items-center gap-6 lg:mt-16">
          <button
            type="button"
            onClick={openBookingModal}
            className="bg-[var(--gold)] px-8 py-4 text-sm font-semibold text-[#0e0e0e] hover:bg-[var(--gold-deep)]"
            style={{ borderRadius: "4px" }}
          >
            Get a table
          </button>

          <Link
            href="/locations"
            className="border-b border-[var(--ivory)]/30 pb-1 text-sm transition-colors hover:border-[var(--gold)] hover:text-[var(--gold)]"
          >
            See both rooms
          </Link>
        </div>
      </div>
    </section>
  );
}

function FragmentBlock({ fragment, index }: { fragment: Fragment; index: number }) {
  const fromLeft = fragment.from === "left";
  const hasText = Boolean(fragment.headline);

  return (
    <div
      className={`room-fragment relative ${fragment.className}`}
      data-from={fragment.from}
      data-distance={fragment.distance}
      data-drift={fragment.drift}
      style={{ zIndex: 10 - index }}
    >
      <figure className="relative h-full w-full overflow-hidden">
        <div className="room-photo absolute inset-0">
          <Image
            src={fragment.src}
            alt={fragment.alt}
            fill
            sizes="(max-width: 1024px) 76vw, 44vw"
            className="object-cover"
          />
        </div>

        <span className="pointer-events-none absolute inset-2 border border-white/[0.07]" />
      </figure>

      {/* Desktop: the text sits beside the image, outside the frame, and
          large enough to be the point rather than a label. */}
      {hasText && (
        <div
          className={`absolute top-1/2 hidden -translate-y-1/2 lg:block ${
            fromLeft
              ? "left-[calc(100%+3rem)] w-[26vw] max-w-md"
              : "right-[calc(100%+3rem)] w-[26vw] max-w-md text-right"
          }`}
        >
          {fragment.eyebrow && (
            <p className="room-line label-caps mb-4 text-[var(--gold)]">
              {fragment.eyebrow}
            </p>
          )}

          {/* Display serif, genuinely large — this is the copy carrying the
              section, not a caption underneath a photograph. */}
          <p className="room-line font-display text-[clamp(1.5rem,2.2vw,2.25rem)] leading-[1.15] tracking-[-0.01em] text-[var(--ivory)]">
            {fragment.headline}
          </p>

          {fragment.body && (
            <p className="room-line mt-4 text-base leading-relaxed text-[var(--ivory-dim)]">
              {fragment.body}
            </p>
          )}
        </div>
      )}

      {/* Mobile: underneath, still large. Body sans for the supporting line
          keeps the pairing the design system asks for. */}
      {hasText && (
        <div className={`mt-5 lg:hidden ${fromLeft ? "max-w-sm" : "ml-auto max-w-sm text-right"}`}>
          {fragment.eyebrow && (
            <p className="room-line label-caps mb-2.5 text-[var(--gold)]">
              {fragment.eyebrow}
            </p>
          )}

          <p className="room-line font-display text-[clamp(1.375rem,5.5vw,1.75rem)] leading-[1.15] text-[var(--ivory)]">
            {fragment.headline}
          </p>

          {fragment.body && (
            <p className="room-line mt-3 text-sm leading-relaxed text-[var(--ivory-dim)]">
              {fragment.body}
            </p>
          )}
        </div>
      )}
    </div>
  );
}