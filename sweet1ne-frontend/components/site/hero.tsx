"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { SplitReveal } from "./motion/split-reveal";
import { Magnetic } from "./motion/magnetic";

// The encoded files are already trimmed to 11 seconds, so `loop` on the
// element does the work — this is here for if the untrimmed footage is ever
// swapped in.
const LOOP_END_SECONDS = 11;

export function Hero() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Anyone who's asked for less motion keeps the poster instead.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // timeupdate only fires a few times a second, so check slightly early —
    // otherwise the video reaches its real end first and stops dead.
    const onTimeUpdate = () => {
      if (video.currentTime >= LOOP_END_SECONDS - 0.15) {
        video.currentTime = 0;
        video.play().catch(() => {});
      }
    };

    // If it does reach the end, restart rather than leaving a blank frame.
    const onEnded = () => {
      video.currentTime = 0;
      video.play().catch(() => {});
    };

    const onCanPlay = () => setVideoReady(true);

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("ended", onEnded);
    video.addEventListener("canplaythrough", onCanPlay);

    // Autoplay can still be refused despite being muted — if it is, the
    // poster simply stays, which is a perfectly good hero.
    video.play().catch(() => {});

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("canplaythrough", onCanPlay);
    };
  }, []);

  return (
    <section className="relative min-h-[100svh] w-full overflow-hidden">
      {/* Poster underneath — visible instantly, and what's left if the video
          never loads or motion is reduced. */}
      <Image
        src="/images/food/hero-poster.jpg"
        alt="A Sweet1NE table mid-meal — seafood boil, sharing platters and sides"
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />

      <video
        ref={videoRef}
        muted
        loop
        // Without this, iOS opens the video fullscreen instead of inline.
        playsInline
        preload="metadata"
        poster="/images/food/hero-poster.jpg"
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
          videoReady ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Smaller encode first — the browser takes the first source whose
            media query matches, so phones never fetch the large file. */}
        <source src="/videos/hero-mobile.mp4" type="video/mp4" media="(max-width: 768px)" />
        <source src="/videos/hero.mp4" type="video/mp4" />
      </video>

      {/* Two gradients rather than one flat scrim: the food stays lit in the
          middle while type stays readable top and bottom. */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e] via-[#0e0e0e]/30 to-[#0e0e0e]/70" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0e0e0e]/80 via-transparent to-transparent" />

      <div className="glow left-[10%] top-[30%] h-[420px] w-[420px]" />

      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-[1440px] flex-col justify-end px-5 pb-20 sm:px-8 sm:pb-28 lg:px-12">
        <p className="label-caps mb-6 text-[var(--gold)]">
          Afro-Caribbean fusion · South East London
        </p>

        <SplitReveal
          as="h1"
          delay={0.2}
          className="max-w-4xl font-display text-[clamp(2.75rem,8vw,6rem)] leading-[0.95] tracking-[-0.02em]"
        >
          {"Food you'll\ntravel for."}
        </SplitReveal>

        <p className="mt-8 max-w-md text-lg leading-relaxed text-[var(--ivory-dim)]">
          Seafood boils poured straight onto the table. Platters built for
          sharing. Everything 100% Halal.
        </p>

        <div className="mt-10 flex flex-wrap gap-4">
          <Magnetic>
            <Link
              href="/reservations"
              className="inline-block bg-[var(--gold)] px-8 py-4 text-sm font-semibold text-[#0e0e0e] hover:bg-[var(--gold-deep)]"
              style={{ borderRadius: "4px" }}
            >
              Book a table
            </Link>
          </Magnetic>

          <Link
            href="/menu"
            className="border border-[var(--ivory)]/40 px-8 py-4 text-sm font-semibold hover:border-[var(--gold)] hover:text-[var(--gold)]"
            style={{ borderRadius: "4px" }}
          >
            See the menu
          </Link>
        </div>
      </div>
    </section>
  );
}