"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowUpRight, Clock, MapPin, Phone } from "lucide-react";
import { Eyebrow } from "./section";
import { SplitReveal } from "./motion/split-reveal";
import { LOCATIONS, type Location } from "@/lib/site-content";

gsap.registerPlugin(ScrollTrigger);

/**
 * Two doors, not two cards.
 *
 * The decision here isn't "which is better" — it's "which is near me". So
 * this isn't a comparison table: on desktop the panels respond to attention,
 * one expanding as the other steps back; on mobile the rooms arrive from
 * opposite edges, images breaking past the gutter.
 *
 * Both hand off to the locations page rather than trying to close a booking
 * here — someone still choosing a branch isn't ready to book.
 */
export function LocationsPreview() {
  const [focused, setFocused] = useState<number | null>(null);

  return (
    // overflow-hidden is load-bearing — the mobile images use negative
    // margins to break the gutter and would otherwise scroll the page.
    <section className="relative overflow-hidden py-16 sm:py-20 lg:py-24">
      <div className="glow right-[-8%] top-1/4 h-[460px] w-[460px] opacity-60" />

      <div className="relative mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
        <div className="mb-10 max-w-xl sm:mb-14">
          <Eyebrow>Find us</Eyebrow>
          <SplitReveal
            as="h2"
            className="font-display text-[clamp(2rem,5.5vw,3.75rem)] leading-[1] tracking-[-0.02em]"
          >
            {"Two rooms in London,\nwherever you are."}
          </SplitReveal>

          <p className="mt-6 text-lg leading-relaxed text-[var(--ivory-dim)]">
            Same kitchen, same menu, same night out — one in the south, one in
            the east. Both fill up, so it's worth booking either way.
          </p>
        </div>
      </div>

      {/* Desktop */}
      <div className="relative hidden lg:flex lg:h-[78vh] lg:min-h-[560px] lg:gap-1">
        {LOCATIONS.map((location, i) => (
          <LocationPanel
            key={location.slug}
            location={location}
            index={i}
            focused={focused}
            onFocus={() => setFocused(i)}
            onBlur={() => setFocused(null)}
          />
        ))}
      </div>

      {/* Mobile */}
      <div className="space-y-20 lg:hidden">
        {LOCATIONS.map((location, i) => (
          <MobileLocation key={location.slug} location={location} index={i} />
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Desktop                                                             */
/* ------------------------------------------------------------------ */

function LocationPanel({
  location,
  index,
  focused,
  onFocus,
  onBlur,
}: {
  location: Location;
  index: number;
  focused: number | null;
  onFocus: () => void;
  onBlur: () => void;
}) {
  const ref = useRef<HTMLElement>(null);

  const isFocused = focused === index;
  const isDimmed = focused !== null && !isFocused;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      // The panels rise in as they enter, the second slightly behind the
      // first, so they arrive as a pair rather than together.
      gsap.fromTo(
        el,
        { yPercent: 8, opacity: 0 },
        {
          yPercent: 0,
          opacity: 1,
          duration: 1.1,
          delay: index * 0.12,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        }
      );

      gsap.fromTo(
        el.querySelector(".panel-photo"),
        { filter: "blur(16px)", scale: 1.18 },
        {
          filter: "blur(0px)",
          scale: 1,
          duration: 1.5,
          delay: index * 0.12,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        }
      );
    }, el);

    return () => ctx.revert();
  }, [index]);

  return (
    <article
      ref={ref}
      onMouseEnter={onFocus}
      onMouseLeave={onBlur}
      // flex-grow is what makes one panel take space from the other. The
      // long duration and easing curve are what make it feel weighted
      // rather than snappy.
      className={`group relative overflow-hidden transition-all duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isFocused ? "flex-[1.45]" : isDimmed ? "flex-[0.8]" : "flex-1"
      }`}
      style={{ minHeight: "min(78vh, 560px)" }}
    >
      <div className="panel-photo absolute inset-0">
        <Image
          src={location.images[0]}
          alt={location.name}
          fill
          sizes="50vw"
          className="object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.05]"
        />
      </div>

      {/* Dims as the other panel takes focus — attention follows the cursor
          without anything moving that shouldn't. */}
      <div
        className={`absolute inset-0 transition-colors duration-[900ms] ${
          isDimmed ? "bg-[#0e0e0e]/70" : "bg-[#0e0e0e]/35"
        }`}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e] via-[#0e0e0e]/20 to-transparent" />

      {/* The area runs vertically up the left edge — a small piece of
          structure that stops both panels reading identically. */}
      <p className="label-caps absolute left-9 top-10 origin-left -rotate-90 translate-y-[7rem] text-[var(--gold)]">
        {location.area}
      </p>

      <div className="relative flex h-full flex-col justify-end p-10 pl-20">
        <h3 className="font-display text-[clamp(2rem,5vw,3.25rem)] leading-[0.98] tracking-[-0.02em]">
          {location.shortName}
        </h3>

        {/* Opens as the panel takes focus, so the resting state stays clean. */}
        <div
          className={`mt-5 space-y-3 overflow-hidden transition-all duration-[900ms] ${
            isFocused ? "max-h-56 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <p className="flex items-start gap-3 text-sm text-[var(--ivory-dim)]">
            <MapPin size={15} strokeWidth={1} className="mt-0.5 shrink-0 text-[var(--gold)]" />
            {location.address}
          </p>

          <p className="flex items-start gap-3 text-sm text-[var(--ivory-dim)]">
            <Clock size={15} strokeWidth={1} className="mt-0.5 shrink-0 text-[var(--gold)]" />
            {location.hoursSummary}
          </p>

          
          <a  href={`tel:${location.phoneHref}`}
            className="flex items-start gap-3 text-sm text-[var(--ivory-dim)] transition-colors hover:text-[var(--gold)]"
          >
            <Phone size={15} strokeWidth={1} className="mt-0.5 shrink-0 text-[var(--gold)]" />
            {location.phone}
          </a>
        </div>

        {location.perks.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {location.perks.slice(0, 3).map((perk) => (
              <span
                key={perk}
                className="label-caps border border-[var(--hairline-faint)] px-2.5 py-1 text-[var(--ivory-dim)]"
                style={{ borderRadius: "4px" }}
              >
                {perk}
              </span>
            ))}
          </div>
        )}

        <div className="mt-7 flex flex-wrap items-center gap-5">
          <Link
            href={`/locations#${location.slug}`}
            className="bg-[var(--gold)] px-6 py-3.5 text-sm font-semibold text-[#0e0e0e] transition-colors hover:bg-[var(--gold-deep)]"
            style={{ borderRadius: "4px" }}
          >
            Explore {location.shortName}
          </Link>

          
          <a  href={location.mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 border-b border-[var(--ivory)]/30 pb-1 text-sm transition-colors hover:border-[var(--gold)] hover:text-[var(--gold)]"
          >
            Directions
            <ArrowUpRight size={14} strokeWidth={1} />
          </a>
        </div>
      </div>

      {/* A gold edge on the focused panel — the only hard line in the
          section, marking where attention is. */}
      <span
        className={`pointer-events-none absolute inset-y-0 left-0 w-px bg-[var(--gold)] transition-opacity duration-700 ${
          isFocused ? "opacity-100" : "opacity-0"
        }`}
      />
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Mobile                                                              */
/* ------------------------------------------------------------------ */

/**
 * Each room arrives from a different edge, the image breaking out past the
 * page gutter while the details step in from the opposite side.
 *
 * The asymmetry is the point — two panels stacked read as a list; two rooms
 * arriving from opposite directions read as a choice.
 */
function MobileLocation({ location, index }: { location: Location; index: number }) {
  const ref = useRef<HTMLElement>(null);
  const fromLeft = index % 2 === 0;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      // The image travels in from its edge, scrubbed to scroll.
      gsap.fromTo(
        el.querySelector(".mobile-frame"),
        { xPercent: fromLeft ? -55 : 55, opacity: 0, rotate: fromLeft ? -3 : 3 },
        {
          xPercent: 0,
          opacity: 1,
          rotate: 0,
          ease: "power4.out",
          scrollTrigger: { trigger: el, start: "top 92%", end: "top 50%", scrub: 1 },
        }
      );

      gsap.fromTo(
        el.querySelector(".mobile-photo"),
        { filter: "blur(16px)", scale: 1.2 },
        {
          filter: "blur(0px)",
          scale: 1,
          ease: "none",
          scrollTrigger: { trigger: el, start: "top 92%", end: "top 50%", scrub: 1 },
        }
      );

      // The details come from the opposite edge, a beat behind — so the two
      // halves close on each other rather than arriving together.
      gsap.fromTo(
        el.querySelectorAll(".mobile-line"),
        { x: fromLeft ? 45 : -45, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 0.9,
          stagger: 0.08,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 68%", once: true },
        }
      );

      // The oversized name drifts against the scroll, separating from the
      // image behind it.
      gsap.fromTo(
        el.querySelector(".mobile-name"),
        { yPercent: 14 },
        {
          yPercent: -14,
          ease: "none",
          scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: 1 },
        }
      );
    }, el);

    return () => ctx.revert();
  }, [fromLeft]);

  return (
    <article ref={ref} className="relative">
      {/* Wrapping the frame and the name together means the name is anchored
          to the image's bottom edge rather than a percentage of the whole
          article — so it can't drift into the details below on a short
          viewport. */}
      <div className="relative">
        <div
          className={`mobile-frame relative aspect-[4/5] w-[86%] overflow-hidden ${
            fromLeft ? "-ml-5 sm:-ml-8" : "-mr-5 ml-auto sm:-mr-8"
          }`}
        >
          <div className="mobile-photo absolute inset-0">
            <Image
              src={location.images[0]}
              alt={location.name}
              fill
              sizes="86vw"
              className="object-cover"
            />
          </div>

          <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e] via-transparent to-transparent" />
          <span className="pointer-events-none absolute inset-2 border border-white/[0.07]" />
        </div>

        {/* Sits across the image's bottom edge, half over and half off —
            the deliberate break from a contained card. */}
        <h3
          className={`mobile-name pointer-events-none absolute -bottom-6 z-10 font-display leading-[0.9] tracking-[-0.03em] ${
            fromLeft ? "right-4" : "left-4"
          }`}
          style={{ fontSize: "clamp(2.25rem, 11vw, 3.75rem)" }}
        >
          {location.shortName}
        </h3>
      </div>

      {/* Details, stepping in from the opposite side. mt-14 clears the name
          overhanging above. */}
      <div className={`relative z-10 mt-14 px-5 sm:px-8 ${fromLeft ? "text-right" : ""}`}>
        <p className="mobile-line label-caps mb-4 text-[var(--gold)]">{location.area}</p>

        <div className={`max-w-xs space-y-2.5 ${fromLeft ? "ml-auto" : ""}`}>
          <p
            className={`mobile-line flex items-start gap-2.5 text-sm text-[var(--ivory-dim)] ${
              fromLeft ? "flex-row-reverse text-right" : ""
            }`}
          >
            <MapPin size={14} strokeWidth={1} className="mt-0.5 shrink-0 text-[var(--gold)]" />
            {location.address}
          </p>

          <p
            className={`mobile-line flex items-start gap-2.5 text-sm text-[var(--ivory-dim)] ${
              fromLeft ? "flex-row-reverse text-right" : ""
            }`}
          >
            <Clock size={14} strokeWidth={1} className="mt-0.5 shrink-0 text-[var(--gold)]" />
            {location.hoursSummary}
          </p>

          
          <a  href={`tel:${location.phoneHref}`}
            className={`mobile-line flex items-start gap-2.5 text-sm text-[var(--ivory-dim)] ${
              fromLeft ? "flex-row-reverse text-right" : ""
            }`}
          >
            <Phone size={14} strokeWidth={1} className="mt-0.5 shrink-0 text-[var(--gold)]" />
            {location.phone}
          </a>
        </div>

        <div className={`mobile-line mt-5 flex flex-wrap gap-2 ${fromLeft ? "justify-end" : ""}`}>
          {location.perks.slice(0, 3).map((perk) => (
            <span
              key={perk}
              className="label-caps border border-[var(--hairline-faint)] px-2.5 py-1 text-[var(--ivory-dim)]"
              style={{ borderRadius: "4px" }}
            >
              {perk}
            </span>
          ))}
        </div>

        <div
          className={`mobile-line mt-7 flex flex-wrap items-center gap-5 ${
            fromLeft ? "justify-end" : ""
          }`}
        >
          <Link
            href={`/locations#${location.slug}`}
            className="bg-[var(--gold)] px-6 py-3.5 text-sm font-semibold text-[#0e0e0e]"
            style={{ borderRadius: "4px" }}
          >
            Explore {location.shortName}
          </Link>

          
          <a  href={location.mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 border-b border-[var(--ivory)]/30 pb-1 text-sm"
          >
            Directions
            <ArrowUpRight size={14} strokeWidth={1} />
          </a>
        </div>
      </div>
    </article>
  );
}