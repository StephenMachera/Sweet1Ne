"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { SplitReveal } from "./motion/split-reveal";
import { Magnetic } from "./motion/magnetic";
import { openBookingModal } from "./booking-modal";

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
    <section
      aria-label="Sweet1ne"
      className="relative grid min-h-[100svh] w-full items-end overflow-hidden"
    >
      {/* Poster underneath — visible instantly, and what's left if the video
          never loads or motion is reduced. */}
      <Image
        src="/images/food/hero-poster.jpg"
        alt=""
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
        className={`absolute inset-0 z-[1] h-full w-full object-cover transition-opacity duration-1000 ${
          videoReady ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Smaller encode first — the browser takes the first source whose
            media query matches, so phones never fetch the large file. */}
        <source
          src="/videos/story-hero-mobile.mp4"
          type="video/mp4"
          media="(max-width: 768px)"
        />
        <source src="/videos/story-hero.mp4" type="video/mp4" />
      </video>

      {/* A vertical fade to black at the foot, and a horizontal one from the
          left so type stays readable over a bright frame. */}
      <div
        className="pointer-events-none absolute inset-0 z-[2]"
        style={{
          background:
            "linear-gradient(to top, #0e0e0e 0%, rgba(14,14,14,.42) 46%, rgba(14,14,14,.5) 100%), linear-gradient(to right, rgba(14,14,14,.78) 0%, rgba(14,14,14,.18) 52%, transparent 72%)",
        }}
      />

      <div className="glow left-[10%] top-[30%] z-[2] h-[420px] w-[420px]" />

      <div className="relative z-[3] min-w-0 max-w-[42rem] px-[1.15rem] pb-[2.35rem] sm:px-6 sm:pb-[3.4rem]">
        <p className="mb-3 text-[0.72rem] uppercase tracking-[0.2em] text-[var(--gold)]">
          Lewisham · Chingford
        </p>

        <SplitReveal
          as="h1"
          delay={0.2}
          className="mb-[0.9rem] font-display text-[clamp(2.05rem,10vw,2.5rem)] font-medium leading-[1.04] [overflow-wrap:break-word] sm:text-[clamp(2.5rem,7vw,4.6rem)]"
        >
          {"Always in the mood\nfor you."}
        </SplitReveal>

        <p className="mb-[1.6rem] max-w-[26rem] text-[var(--ivory-dim)]">
          Two restaurants. Same kitchen. Same sweetness.
        </p>

        <div className="flex flex-wrap items-center gap-x-[1.15rem] gap-y-[0.7rem]">
          <Magnetic>
            <button
              type="button"
              onClick={openBookingModal}
              className="bg-[var(--gold)] px-[0.9rem] py-[0.58rem] text-[0.75rem] font-semibold text-[#0e0e0e] transition-opacity hover:opacity-90 sm:px-[1.2rem] sm:py-[0.7rem] sm:text-[0.82rem]"
              style={{ borderRadius: "4px" }}
            >
              Book a table
            </button>
          </Magnetic>

          <Link
            href="#restaurants"
            className="border-b border-[rgba(201,162,74,.55)] pb-[0.12rem] text-[0.85rem] text-[var(--ivory)] transition-colors hover:border-[var(--gold)] hover:text-[var(--gold)]"
          >
            Choose a restaurant
          </Link>
        </div>
      </div>
    </section>
  );
}