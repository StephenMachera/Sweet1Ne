"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowUpRight, Clock, Mail, MapPin, Phone, Train } from "lucide-react";
import { LOCATIONS, type Location } from "@/lib/site-content";

gsap.registerPlugin(ScrollTrigger);

export function LocationSections() {
  return (
    <>
      {LOCATIONS.map((location, i) => (
        <LocationSection key={location.slug} location={location} index={i} />
      ))}
    </>
  );
}

function LocationSection({ location, index }: { location: Location; index: number }) {
  const ref = useRef<HTMLElement>(null);
  const flipped = index % 2 === 1;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      // The main image arrives from its side, resolving from blur.
      gsap.fromTo(
        el.querySelector(".loc-hero"),
        { xPercent: flipped ? 30 : -30, opacity: 0 },
        {
          xPercent: 0,
          opacity: 1,
          ease: "power4.out",
          scrollTrigger: { trigger: el, start: "top 88%", end: "top 45%", scrub: 1 },
        }
      );

      gsap.fromTo(
        el.querySelector(".loc-photo"),
        { filter: "blur(18px)", scale: 1.2 },
        {
          filter: "blur(0px)",
          scale: 1,
          ease: "none",
          scrollTrigger: { trigger: el, start: "top 88%", end: "top 45%", scrub: 1 },
        }
      );

      // Details step in from the opposite side, a beat behind.
      gsap.fromTo(
        el.querySelectorAll(".loc-line"),
        { x: flipped ? -40 : 40, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 0.9,
          stagger: 0.07,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 65%", once: true },
        }
      );

      // The two supporting shots surface later, offset from each other.
      gsap.fromTo(
        el.querySelectorAll(".loc-support"),
        { y: 40, opacity: 0, filter: "blur(12px)" },
        {
          y: 0,
          opacity: 1,
          filter: "blur(0px)",
          duration: 1,
          stagger: 0.15,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 45%", once: true },
        }
      );

      // The oversized name drifts against the scroll.
      gsap.fromTo(
        el.querySelector(".loc-name"),
        { yPercent: 12 },
        {
          yPercent: -12,
          ease: "none",
          scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: 1 },
        }
      );
    }, el);

    return () => ctx.revert();
  }, [flipped]);

  return (
    <section
      ref={ref}
      // The anchor the homepage links to — /locations#lewisham.
      id={location.slug}
      // scroll-mt clears the fixed header when the anchor lands.
      className="relative scroll-mt-24 overflow-hidden border-b border-[var(--hairline-faint)] py-16 last:border-0 sm:py-24"
    >
      <div
        className={`glow top-1/4 h-[460px] w-[460px] opacity-60 ${
          flipped ? "right-[-10%]" : "left-[-10%]"
        }`}
      />

      <div className="relative mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
        <div
          className={`grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16 ${
            flipped ? "lg:[&>*:first-child]:order-2" : ""
          }`}
        >
          {/* Photography */}
          <div className="relative">
            <div className="loc-hero relative aspect-[4/3] overflow-hidden">
              <div className="loc-photo absolute inset-0">
                <Image
                  src={location.images[0]}
                  alt={location.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
              <span className="pointer-events-none absolute inset-2.5 border border-white/[0.07]" />
            </div>

            {/* The name breaks the frame's bottom edge. */}
            <h2
              className={`loc-name pointer-events-none absolute -bottom-5 z-10 font-display leading-[0.9] tracking-[-0.03em] ${
                flipped ? "left-4" : "right-4"
              }`}
              style={{ fontSize: "clamp(2.25rem, 8vw, 4rem)" }}
            >
              {location.shortName}
            </h2>

            <div className="mt-8 grid grid-cols-2 gap-4">
              {location.images.slice(1, 3).map((src) => (
                <div key={src} className="loc-support relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={src}
                    alt=""
                    fill
                    sizes="(max-width: 1024px) 50vw, 25vw"
                    className="object-cover"
                  />
                  <span className="pointer-events-none absolute inset-2 border border-white/[0.07]" />
                </div>
              ))}
            </div>
          </div>

          {/* Details */}
          <div className={flipped ? "lg:pr-8" : "lg:pl-8"}>
            <p className="loc-line label-caps text-[var(--gold)]">
              {location.area} · Opened {location.opened}
            </p>

            <p className="loc-line mt-6 text-lg leading-relaxed text-[var(--ivory-dim)]">
              {location.blurb}
            </p>

            {/* Opening hours in full — including the kitchen times, which are
                the detail that saves a wasted journey. */}
            <div className="loc-line mt-10 border-t border-[var(--hairline-faint)] pt-6">
              <p className="label-caps mb-4 flex items-center gap-2 text-[var(--gold)]">
                <Clock size={14} strokeWidth={1} />
                Opening hours
              </p>

              <dl className="space-y-2.5">
                {location.hours.map((entry) => {
                  const closed = entry.time === "Closed";
                  return (
                    <div key={entry.days} className="flex justify-between gap-4 text-sm">
                      <dt className={closed ? "text-[var(--muted)]" : "text-[var(--ivory-dim)]"}>
                        {entry.days}
                      </dt>
                      <dd className="shrink-0 text-right">
                        <span className={closed ? "text-[var(--muted)]" : "text-[var(--ivory)]"}>
                          {entry.time}
                        </span>
                        {entry.kitchen && (
                          <span className="mt-0.5 block text-xs text-[var(--gold)]">
                            {entry.kitchen}
                          </span>
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>

            {/* Getting there */}
            <div className="loc-line mt-8 space-y-5 border-t border-[var(--hairline-faint)] pt-6">
              <div className="flex items-start gap-3">
                <MapPin size={16} strokeWidth={1} className="mt-1 shrink-0 text-[var(--gold)]" />
                <div>
                  <p className="label-caps text-[var(--muted)]">Address</p>
                  <address className="mt-1.5 not-italic text-[var(--ivory)]">
                    {location.addressLines.map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                  </address>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Train size={16} strokeWidth={1} className="mt-1 shrink-0 text-[var(--gold)]" />
                <div>
                  <p className="label-caps text-[var(--muted)]">Getting here</p>
                  <div className="mt-1.5 space-y-0.5 text-[var(--ivory)]">
                    {location.transport.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone size={16} strokeWidth={1} className="mt-1 shrink-0 text-[var(--gold)]" />
                <div>
                  <p className="label-caps text-[var(--muted)]">Phone</p>
                  
                  <a  href={`tel:${location.phoneHref}`}
                    className="mt-1 block font-display text-2xl text-[var(--ivory)] transition-colors hover:text-[var(--gold)]"
                  >
                    {location.phone}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail size={16} strokeWidth={1} className="mt-1 shrink-0 text-[var(--gold)]" />
                <div>
                  <p className="label-caps text-[var(--muted)]">Email</p>
                  
                  <a  href={`mailto:${location.email}`}
                    className="mt-1 block text-[var(--ivory)] transition-colors hover:text-[var(--gold)]"
                  >
                    {location.email}
                  </a>
                </div>
              </div>
            </div>

            {location.perks.length > 0 && (
              <div className="loc-line mt-8 flex flex-wrap gap-2">
                {location.perks.map((perk) => (
                  <span
                    key={perk}
                    className="label-caps border border-[var(--hairline-faint)] px-3 py-1.5 text-[var(--ivory-dim)]"
                    style={{ borderRadius: "4px" }}
                  >
                    {perk}
                  </span>
                ))}
              </div>
            )}

            <div className="loc-line mt-10 flex flex-wrap items-center gap-5">
              <Link
                href="/reservations"
                className="bg-[var(--gold)] px-7 py-4 text-sm font-semibold text-[#0e0e0e] transition-colors hover:bg-[var(--gold-deep)]"
                style={{ borderRadius: "4px" }}
              >
                Book {location.shortName}
              </Link>

              
             <a href={location.mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 border border-[var(--ivory)]/40 px-7 py-4 text-sm font-semibold transition-colors hover:border-[var(--gold)] hover:text-[var(--gold)]"
                style={{ borderRadius: "4px" }}
              >
                Directions
                <ArrowUpRight size={15} strokeWidth={1.5} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}