"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Eyebrow } from "./section";
import { SplitReveal } from "./motion/split-reveal";

gsap.registerPlugin(ScrollTrigger);

/**
 * The quiet moment.
 *
 * Two full-bleed sections precede this one, so a third would turn the page
 * into a slideshow. This is deliberately typographic and contained —
 * somewhere for the eye to rest, which is what makes the next full-bleed
 * thing land properly.
 */
export function StoryStrip() {
  const imageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = imageRef.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      const frame = el.querySelector(".story-frame");
      const photo = el.querySelector(".story-photo");
      const rule = el.querySelector(".story-rule");

      const timeline = gsap.timeline({
        scrollTrigger: { trigger: el, start: "top 78%", once: true },
      });

      timeline
        // The frame draws itself before anything appears inside it.
        .fromTo(
          rule,
          { scaleY: 0 },
          { scaleY: 1, duration: 0.7, ease: "power2.inOut", transformOrigin: "top" }
        )
        // Then the image surfaces — same blur-to-focus language as the
        // dishes above, so the page keeps one motion vocabulary.
        .fromTo(
          frame,
          { clipPath: "inset(100% 0% 0% 0%)" },
          { clipPath: "inset(0% 0% 0% 0%)", duration: 1, ease: "power3.inOut" },
          "-=0.3"
        )
        .fromTo(
          photo,
          { filter: "blur(14px)", scale: 1.15 },
          { filter: "blur(0px)", scale: 1, duration: 1.2, ease: "power3.out" },
          "<"
        );
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section className="relative pb-20 pt-14 sm:pb-28 sm:pt-20 lg:pb-36 lg:pt-24">
      {/* Softer and lower than elsewhere — atmosphere without another image. */}
      <div className="glow left-[55%] top-1/3 h-[420px] w-[420px] opacity-60" />

      <div className="relative mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
        <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-20">
          {/* Words */}
          <div>
            <Eyebrow>Our story</Eyebrow>

            <SplitReveal
              as="h2"
              className="font-display text-[clamp(2rem,5.5vw,3.75rem)] leading-[1.02] tracking-[-0.02em]"
            >
              {"Black-owned.\nLondon built."}
            </SplitReveal>

            {/* The pull quote does the heavy lifting — set large, given
                room, and marked by a gold rule rather than quotation marks. */}
            <blockquote className="mt-10 border-l border-[var(--hairline)] pl-6 sm:pl-8">
              <p className="font-display text-[clamp(1.375rem,2.5vw,1.875rem)] leading-[1.35] text-[var(--ivory)]">
                Food people grew up eating, in a room worth eating it in.
              </p>
            </blockquote>

            <div className="mt-8 max-w-lg space-y-5 text-lg leading-relaxed text-[var(--ivory-dim)]">
              <p>
                Sweet1NE started in 2020 as a small takeaway in Ilford —
                Afro-Caribbean cooking with the heritage of American soul food
                behind it. Lewisham followed in 2023, and Chingford after that.
              </p>
              <p>
                Everything on the menu is Halal. Everything on the menu is meant
                to be shared.
              </p>
            </div>

            <Link
              href="/story"
              className="mt-10 inline-block border-b border-[var(--ivory)]/30 pb-1 text-sm transition-colors hover:border-[var(--gold)] hover:text-[var(--gold)]"
            >
              Read the full story
            </Link>
          </div>

          {/* One contained image. Portrait, framed, deliberately not
              edge-to-edge — that's the whole point of this section. */}
          <div ref={imageRef} className="relative">
            {/* The rule that draws in first, anchoring the frame. */}
            <span
              className="story-rule absolute -left-4 top-0 hidden h-full w-px bg-gradient-to-b from-[var(--gold)] via-[var(--hairline)] to-transparent lg:block"
              style={{ transform: "scaleY(0)" }}
            />

            <div
              className="story-frame relative aspect-[3/4] overflow-hidden"
              style={{ clipPath: "inset(100% 0% 0% 0%)" }}
            >
              <div className="story-photo absolute inset-0">
                <Image
                  src="/images/interiors/room-full.jpg"
                  alt="The dining room at Sweet1NE"
                  fill
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  className="object-cover"
                />
              </div>

              {/* A hairline inside the frame rather than a border on it —
                  sits on the image the way a mount sits on a print. */}
              <span className="pointer-events-none absolute inset-3 border border-white/10" />
            </div>

            <p className="label-caps mt-4 text-[var(--muted)]">
              Lewisham · Saturday, 9pm
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}