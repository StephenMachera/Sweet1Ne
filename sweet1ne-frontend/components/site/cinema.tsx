"use client";

import { useEffect, useRef, useState } from "react";

type Beat = {
  id: string;
  poster: string;
  sources: { src: string; media?: string }[];
  /** The films are cropped hard, so each needs its own framing. */
  objectPosition: string;
};

const BEATS: Beat[] = [
  {
    id: "night",
    poster: "/images/homepage-gallery/events/poster-events.jpg",
    sources: [{ src: "/videos/film-events.mp4" }],
    objectPosition: "50% 16%",
  },
  {
    id: "room",
    poster: "/images/homepage-gallery/cinematic/poster-chingford-open.jpg",
    sources: [{ src: "/videos/film-chingford.mp4" }],
    objectPosition: "58% center",
  },
];

const BEAT_EVERY_MS = 9000;

/**
 * Two films, crossfading.
 *
 * Nine seconds each with a 1.6-second dissolve — long enough that each one
 * is a scene rather than a cut. The pause holds whichever is showing.
 */
export function Cinema({ gated }: { gated: boolean }) {
  const [beat, setBeat] = useState(0);
  const [paused, setPaused] = useState(false);
  const filmsRef = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    filmsRef.current.forEach((film) => {
      if (!film) return;
      film.muted = true;
      film.play().catch(() => {});
    });
  }, []);

  useEffect(() => {
    if (paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = setInterval(
      () => setBeat((current) => (current + 1) % BEATS.length),
      BEAT_EVERY_MS
    );

    return () => clearInterval(timer);
  }, [paused]);

  function togglePause() {
    const next = !paused;
    setPaused(next);

    filmsRef.current.forEach((film) => {
      if (!film) return;
      if (next) film.pause();
      else film.play().catch(() => {});
    });
  }

  return (
    <section
      aria-label="Sweet1NE"
      className="relative h-[100svh] min-h-[32rem] overflow-hidden bg-black"
      data-cinema
    >
      {BEATS.map((item, i) => (
        <div
          key={item.id}
          className="absolute inset-0 transition-opacity duration-[1600ms] ease-in-out motion-reduce:hidden"
          style={{ opacity: i === beat ? 1 : 0 }}
        >
          <video
            ref={(el) => {
              filmsRef.current[i] = el;
            }}
            muted
            loop
            playsInline
            disablePictureInPicture
            preload="auto"
            poster={item.poster}
            className="pointer-events-none block h-full w-full object-cover"
            style={{ objectPosition: item.objectPosition }}
          >
            {item.sources.map((source) => (
              <source
                key={source.src}
                src={source.src}
                type="video/mp4"
                media={source.media}
              />
            ))}
          </video>
        </div>
      ))}

      {/* Reduced motion gets a still rather than film — the fallback is a
          poster, not an empty black panel. */}
      <div
        aria-hidden
        className="absolute inset-0 hidden bg-cover bg-no-repeat motion-reduce:block"
        style={{
          backgroundImage:
            "url('/images/homepage-gallery/cinematic/poster-chingford-open.jpg')",
          backgroundPosition: "58% center",
        }}
      />

      {/* A tall fade at the foot — the section below begins in the film
          rather than after it. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[6] h-[52%]"
        style={{
          background:
            "linear-gradient(to top, #050505 0%, #050505 14%, rgba(5,5,5,.82) 36%, rgba(5,5,5,.38) 62%, transparent 100%)",
        }}
      />

      <div className="pointer-events-none absolute bottom-10 left-1/2 z-[8] w-[calc(100%-1.8rem)] -translate-x-1/2 text-center sm:bottom-[2.5rem] sm:w-[min(36rem,calc(100%-2.4rem))]">
        {/* A gold rule above the kicker — small, and it's what makes the
            block read as composed rather than dropped in. */}
        <span
          aria-hidden
          className="mx-auto mb-[1.05rem] block h-px w-[2.35rem] bg-[var(--gold)]"
        />

        <p
          className="mb-[0.55rem] text-[0.72rem] uppercase tracking-[0.2em] text-[var(--gold)]"
          style={{ textShadow: "0 1px 16px rgba(0,0,0,.85)" }}
        >
          Elevated Afro-Caribbean fusion
        </p>

        <h1
          className="m-0 font-display text-[1.55rem] font-medium leading-tight text-[var(--ivory)] sm:text-[clamp(1.7rem,5vw,3.05rem)]"
          style={{ textShadow: "0 2px 28px rgba(0,0,0,.8)" }}
        >
          A culinary adventure for all the senses.
        </h1>
      </div>

      <button
        type="button"
        onClick={togglePause}
        aria-label={paused ? "Play films" : "Pause films"}
        className="absolute right-[0.85rem] top-[4.55rem] z-[9] grid h-[2.35rem] w-[2.35rem] place-items-center rounded-full border border-[rgba(201,162,74,.55)] bg-[rgba(5,5,5,.4)] text-[0.68rem] text-[var(--ivory)] backdrop-blur transition-opacity duration-[450ms] hover:border-[var(--gold)] motion-reduce:hidden sm:right-5 sm:top-[5.4rem]"
        style={{
          opacity: gated ? 0 : 1,
          pointerEvents: gated ? "none" : "auto",
        }}
      >
        {paused ? "▶" : "II"}
      </button>
    </section>
  );
}