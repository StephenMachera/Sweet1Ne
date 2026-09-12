"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The night, as a film.
 *
 * Plays only while in view — an autoplaying video off-screen is wasted
 * bandwidth, and on a phone that's someone's data.
 */
export function EventsHero() {
  const filmRef = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const film = filmRef.current;
    if (!film) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    film.muted = true;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // A manual pause wins over the observer — otherwise scrolling
          // back would restart something the visitor stopped.
          if (paused) return;

          if (entry.isIntersecting) film.play().catch(() => {});
          else film.pause();
        });
      },
      { threshold: 0.35 }
    );

    observer.observe(film);
    return () => observer.disconnect();
  }, [paused]);

  function togglePause() {
    const film = filmRef.current;
    if (!film) return;

    const next = !paused;
    setPaused(next);

    if (next) film.pause();
    else film.play().catch(() => {});
  }

  return (
    <section
      id="night"
      aria-label="The night"
      className="relative grid min-h-[calc(100svh-4.2rem)] bg-black lg:h-[calc(100svh-4.4rem)] lg:min-h-[36rem] lg:grid-cols-[minmax(20rem,0.92fr)_minmax(22rem,0.78fr)]"
    >
      <div className="stage relative order-1 h-[78svh] min-h-[22rem] overflow-hidden bg-[#0a0a0a] lg:col-start-2 lg:row-start-1 lg:my-[1.1rem] lg:mr-[1.4rem] lg:h-auto lg:min-h-0">
          <video
            ref={filmRef}
            muted
            loop
            playsInline
            preload="auto"
            poster="/images/homepage-gallery/events/poster-events.jpg"
            autoPlay
            className="film block h-full w-full object-cover object-[50%_18%] brightness-[0.82] saturate-[1.05]"
          >
            <source src="/videos/film-events.mp4" type="video/mp4" />
          </video>

          <span
            aria-hidden
            className="veil pointer-events-none absolute inset-0 lg:hidden"
            style={{
              background:
                "linear-gradient(to top, rgba(5,5,5,.75) 0%, rgba(5,5,5,.1) 55%, rgba(5,5,5,.25) 100%)",
            }}
          />

          <button
            type="button"
            onClick={togglePause}
            aria-label={paused ? "Play film" : "Pause film"}
            className="pause absolute bottom-3 right-3 z-[3] grid h-[2.35rem] w-[2.35rem] place-items-center rounded-full border border-[rgba(201,162,74,.55)] bg-[rgba(5,5,5,.5)] text-[0.68rem] text-[var(--ivory)] backdrop-blur transition-colors hover:border-[var(--gold)] motion-reduce:hidden lg:bottom-4 lg:right-10"
          >
            {paused ? "▶" : "II"}
          </button>
          <span aria-hidden className="pointer-events-none absolute inset-0 hidden bg-[linear-gradient(to_right,var(--bg)_0%,transparent_18%)] lg:block" />
      </div>

      <div className="hero-copy relative z-[2] order-2 self-end px-[1.15rem] pb-[2.4rem] pt-0 sm:px-6 lg:col-start-1 lg:row-start-1 lg:self-center lg:px-8 lg:pb-8 lg:pt-[5.5rem]">
        <p className="mb-[0.55rem] text-[0.72rem] uppercase tracking-[0.2em] text-[var(--gold)]">
          What's on
        </p>

        <h1 className="mb-[0.7rem] font-display text-[clamp(2.2rem,8vw,4.2rem)] font-medium leading-[1.02] tracking-[-0.02em] lg:text-shadow-none">
          Nights worth planning around.
        </h1>

        <p className="max-w-[26rem] text-[1.02rem] text-[var(--ivory-dim)]">
          A table. The room. A performance. Book a night — or take the room for
          your own.
        </p>
      </div>
    </section>
  );
}