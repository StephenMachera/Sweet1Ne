"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
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

const GATE_TIMEOUT_MS = 0;
const GATE_EXIT_MS = 500;

/**
 * The homepage: one viewport, two films.
 *
 * A gate holds the page shut while the films buffer — so they start playing
 * rather than stuttering into life. It lifts immediately after the page
 * mounts, or sooner through a click or keypress.
 */
export function FilmDeck() {
  const [opened, setOpened] = useState(false);
  const [gateGone, setGateGone] = useState(false);
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

  const openHouse = useCallback(() => {
    setOpened((already) => {
      if (already) return already;

      // Removed from the tree after the fade, so it can't trap focus.
      setTimeout(() => setGateGone(true), GATE_EXIT_MS);

      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        filmsRef.current.forEach((film) => {
          if (!film) return;
          film.muted = true;
          film.play().catch(() => {});
        });
      }

      return true;
    });
  }, []);

  // Reduced motion skips the gate entirely — it's a flourish, and someone
  // who's asked for less of that shouldn't be made to wait.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      openHouse();
      const timer = setTimeout(() => setGateGone(true), 0);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(openHouse, GATE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [openHouse]);

  // Enter or Space opens it too — the gate is a button in everything but
  // markup, so it should behave like one.
  useEffect(() => {
    if (opened) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
        e.preventDefault();
        openHouse();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [opened, openHouse]);

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
      {/* The films sit fixed behind everything, so no layout flow can leave
          a seam under the header. */}
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
                }}
                muted
                loop
                playsInline
                // auto rather than metadata — the whole point of the gate is
                // giving these time to buffer.
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
              >
                <source
                  src={room.videoMobile}
                  type="video/mp4"
                  media="(max-width: 720px)"
                />
                <source src={room.video} type="video/mp4" />
              </video>

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

      {/* Film grain. Overlay blending lifts the highlights rather than just
          greying the picture. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[60] opacity-[0.12] mix-blend-overlay motion-reduce:hidden"
        style={{
          backgroundImage: "url('/images/homepage-gallery/cinematic/grain.png')",
          backgroundRepeat: "repeat",
          backgroundSize: "240px",
        }}
      />

      {/* Everything below waits for the gate — the page should arrive whole
          rather than in pieces. */}
      <div
        className="pointer-events-none fixed bottom-[1.15rem] left-1/2 z-[70] max-w-[min(90vw,28rem)] -translate-x-1/2 text-center transition-opacity duration-700 sm:bottom-[2.2rem]"
        style={{ opacity: opened ? 1 : 0 }}
      >
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
        className="fixed bottom-[1.15rem] right-[0.85rem] z-[80] grid h-[2.35rem] w-[2.35rem] place-items-center rounded-full border border-[rgba(201,162,74,.55)] bg-[rgba(5,5,5,.4)] text-[0.68rem] text-[var(--ivory)] transition-all duration-700 hover:border-[var(--gold)] motion-reduce:hidden sm:bottom-[2.2rem] sm:right-5"
        style={{
          opacity: opened ? 1 : 0,
          pointerEvents: opened ? "auto" : "none",
        }}
      >
        {paused ? "▶" : "II"}
      </button>

      <p
        className="fixed bottom-[0.55rem] left-[1.1rem] z-[80] hidden text-[0.62rem] tracking-[0.06em] text-[rgba(229,226,225,.42)] transition-opacity duration-700 sm:block"
        style={{ opacity: opened ? 1 : 0 }}
      >
        <Link href="/privacy" className="text-inherit transition-colors hover:text-[var(--gold)]">
          Privacy
        </Link>
        {" · "}
        <Link href="/terms" className="text-inherit transition-colors hover:text-[var(--gold)]">
          Terms
        </Link>
      </p>

      {/* The gate. Removed from the tree once it's faded, so it can't trap
          focus or intercept clicks. */}
      {!gateGone && (
        <div
          onClick={openHouse}
          role="button"
          tabIndex={0}
          aria-label="Step inside"
          className={`home-gate fixed inset-0 z-[100] grid cursor-pointer place-items-center text-center ${
            opened ? "is-out" : ""
          }`}
          style={{
            pointerEvents: opened ? "none" : "auto",
          }}
        >
          <span aria-hidden className="home-gate-leaf home-gate-leaf-left" />
          <span aria-hidden className="home-gate-leaf home-gate-leaf-right" />

          <div className="home-gate-mark relative z-[2] px-5">
            <Image
              src="/images/brand/logo.png"
              alt="Sweet1NE"
              width={268}
              height={268}
              priority
              className="mx-auto h-auto w-[min(58vw,268px)]"
            />
            <hr aria-hidden />
            <p>Always in the mood for you.</p>
          </div>
        </div>
      )}
    </>
  );
}