"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Room = {
  id: string;
  label: string;
  href: string;
  video: string;
  videoMobile: string;
  poster: string;
  /** The films are cropped hard, so each needs its own framing. */
  objectPosition: string;
};

const ROOMS: Room[] = [
  {
    id: "lewisham",
    label: "Lewisham",
    href: "/locations#lewisham",
    video: "/videos/film-lewisham.mp4",
    videoMobile: "/videos/film-lewisham-mobile.mp4",
    poster: "/images/homepage-gallery/cinematic/poster-lewisham-open.jpg",
    objectPosition: "32% center",
  },
  {
    id: "chingford",
    label: "Chingford",
    href: "/locations#chingford",
    video: "/videos/film-chingford.mp4",
    videoMobile: "/videos/film-chingford-mobile.mp4",
    poster: "/images/homepage-gallery/cinematic/poster-chingford-open.jpg",
    objectPosition: "58% center",
  },
];

/**
 * The homepage is one viewport and two films.
 *
 * No sections, no scrolling, no cards. Hovering a panel gives it the room —
 * it expands while the other dims and steps back. On a phone they stack and
 * share the height, since there's no hover to respond to.
 */
export function FilmDeck() {
  const [lead, setLead] = useState<string>("lewisham");
  const [paused, setPaused] = useState(false);
  const filmsRef = useRef<(HTMLVideoElement | null)[]>([]);

  // A single viewport with nothing below it. Cleaned up on navigation so
  // every other page scrolls normally.
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Autoplay needs muted set on the element before play() is called — the
  // attribute alone isn't always enough once React has hydrated.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    filmsRef.current.forEach((film) => {
      if (!film) return;
      film.muted = true;
      film.play().catch(() => {});
    });
  }, []);

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
    <>
      {/* fixed inset-0 rather than a height — the films sit behind the
          header entirely, so no layout flow can leave a seam. */}
      <div className="fixed inset-0 z-0 flex flex-col gap-[5px] bg-black sm:flex-row sm:gap-[6px]">
        {ROOMS.map((room, i) => {
          const isLead = lead === room.id;

          return (
            <Link
              key={room.id}
              href={room.href}
              aria-pressed={isLead}
              onMouseEnter={() => {
                // Pointer devices only — on touch, hover fires on tap and
                // would fight the navigation.
                if (window.matchMedia("(hover: hover)").matches) setLead(room.id);
              }}
              className="relative block min-w-0 overflow-hidden bg-black"
              // The property and its transition live together inline:
              // flex-grow is a single animatable number, where the `flex`
              // shorthand interpolates unreliably across browsers.
              style={{
                flexGrow: isLead ? 1.45 : 0.72,
                flexBasis: 0,
                flexShrink: 1,
                transition: "flex-grow 850ms cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              <video
                ref={(el) => {
                  filmsRef.current[i] = el;
                  if (!el) return;

                  // Both set here as DOM properties. React's `muted` prop
                  // only sets the property, not the attribute, and
                  // `defaultMuted` isn't a React prop at all — but the
                  // browser's own autoplay check wants the element muted
                  // before it tries, which is earlier than any effect.
                  el.muted = true;
                  el.defaultMuted = true;

                  // Chosen here rather than with <source media="…">: Chrome
                  // and Firefox ignore `media` on a <source> inside <video>
                  // (it only works inside <picture>), so they'd always take
                  // the first file listed regardless of screen size.
                  const wanted = window.matchMedia("(max-width: 720px)").matches
                    ? room.videoMobile
                    : room.video;
                  if (!el.src.endsWith(wanted)) el.src = wanted;
                }}
                muted
                loop
                playsInline
                autoPlay
                preload="auto"
                poster={room.poster}
                className="block h-full w-full object-cover"
                style={{
                  objectPosition: room.objectPosition,
                  filter: isLead
                    ? "brightness(1) saturate(1)"
                    : "brightness(0.62) saturate(0.92)",
                  transition: "filter 850ms ease-out",
                }}
              />

              {/* A gentle lift at the foot so the place name stays readable
                  over a bright frame. */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to top, rgba(0,0,0,.5) 0%, transparent 40%)",
                }}
              />

              <span
                className="absolute bottom-[0.85rem] left-[0.9rem] z-[2] text-[0.68rem] uppercase tracking-[0.28em] text-[var(--gold)] sm:bottom-auto sm:left-[1.1rem] sm:top-[5.4rem]"
                style={{ textShadow: "0 1px 8px rgba(0,0,0,.8)" }}
              >
                {room.label}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Film grain, over everything. Overlay blending lifts the highlights
          rather than just greying the picture. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[60] opacity-[0.12] mix-blend-overlay motion-reduce:hidden"
        style={{
          backgroundImage: "url('/images/homepage-gallery/cinematic/grain.png')",
          backgroundRepeat: "repeat",
          backgroundSize: "240px",
        }}
      />

      {/* The slogan belongs to the pair, not either room — so it sits over
          both rather than inside one. */}
      <div className="pointer-events-none fixed bottom-[1.15rem] left-1/2 z-[70] max-w-[min(90vw,28rem)] -translate-x-1/2 text-center sm:bottom-[2.2rem]">
        <p
          className="m-0 font-display text-[1.12rem] font-medium italic leading-[1.15] tracking-[-0.02em] sm:text-[clamp(1.25rem,3vw,2rem)]"
          style={{ textShadow: "0 2px 18px rgba(0,0,0,.75)" }}
        >
          Always in the mood for you.
        </p>
      </div>

      <button
        type="button"
        onClick={togglePause}
        aria-label={paused ? "Play films" : "Pause films"}
        className="fixed bottom-[1.15rem] right-[0.85rem] z-[80] grid h-[2.35rem] w-[2.35rem] place-items-center rounded-full border border-[rgba(201,162,74,.55)] bg-[rgba(5,5,5,.4)] text-[0.68rem] text-[var(--ivory)] transition-colors hover:border-[var(--gold)] motion-reduce:hidden sm:bottom-[2.2rem] sm:right-5"
      >
        {paused ? "▶" : "II"}
      </button>

      <p className="fixed bottom-[0.55rem] left-[1.1rem] z-[80] hidden text-[0.62rem] tracking-[0.06em] text-[rgba(229,226,225,.42)] sm:block">
        <Link href="/privacy" className="text-inherit transition-colors hover:text-[var(--gold)]">
          Privacy
        </Link>
        {" · "}
        <Link href="/terms" className="text-inherit transition-colors hover:text-[var(--gold)]">
          Terms
        </Link>
      </p>
    </>
  );
}