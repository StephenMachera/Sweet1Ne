"use client";

import { useEffect, useRef, useState } from "react";
import { PromoCard } from "@/components/site/home/promo-card";

type FilmsApi = {
  armFilm?: (v: HTMLVideoElement) => void;
};

declare global {
  interface Window {
    sweet1neFilms?: FilmsApi;
  }
}

const DESK_SRC = "/images/homepage-gallery/videos/film-chingford.mp4?v=ching1";
const PHONE_SRC = "/images/homepage-gallery/videos/film-chingford-mobile.mp4?v=ching1";
const POSTER = "/images/homepage-gallery/cinematic/poster-chingford-1080.jpg";

/** The curtain intro + the film it reveals — one component, ported as
   directly as possible from the 8 October homepage-intro pack's own single
   script, because the two are one piece of timing-sensitive logic, not two.

   The iOS rule that matters most: play() only ever runs either as a direct
   result of the autoplay attribute, or synchronously inside a real
   touchend/click handler — never inside a timeout, a fetch, or a promise
   chain. That's why the tap handlers below call video.play() directly
   rather than going through a React state update first. */
export default function Cinema() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const introRef = useRef<HTMLDivElement | null>(null);
  const pauseBtnRef = useRef<HTMLButtonElement | null>(null);

  const [playing, setPlaying] = useState(false);
  const [gated, setGated] = useState(true);
  const [needsTap, setNeedsTap] = useState(false);
  const [introOut, setIntroOut] = useState(false);
  const [introGone, setIntroGone] = useState(false);
  const [hasIntro, setHasIntro] = useState(true);

  useEffect(() => {
    const film = videoRef.current;
    const intro = introRef.current;
    const pauseBtn = pauseBtnRef.current;
    const api = window.sweet1neFilms ?? {};

    const query = String(window.location.search || "");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const skipIntro = /(?:\?|&)open=/.test(query);
    const forceTap = /(?:\?|&)tap=1/.test(query);
    const hold = 2400;
    const outMs = 1150;
    const startedAt = Date.now();

    let held = false;
    let opened = false;
    let rolling = false;
    let tapped = false;
    const timers: number[] = [];
    const setTimer = (fn: () => void, ms: number) => {
      const id = window.setTimeout(fn, ms);
      timers.push(id);
      return id;
    };

    if (!intro || reduce) setHasIntro(false);

    // Picks the file before anything else runs — phones never start
    // downloading the 1080p file. Kept as the very first thing here,
    // matching the pack's own inline script placement.
    if (film && !reduce) {
      const phone = window.matchMedia("(max-width: 720px)").matches;
      film.muted = true;
      film.defaultMuted = true;
      film.playsInline = true;
      film.src = phone ? PHONE_SRC : DESK_SRC;
    }

    function filmPlaying() {
      return !!film && !film.paused && film.readyState > 2;
    }

    function syncPauseBtn() {
      if (!pauseBtn) return;
      setPlaying(filmPlaying());
    }

    function askForTap() {
      if (intro && !opened) setNeedsTap(true);
    }

    function ignite() {
      if (!film || held || reduce) return;
      if (forceTap && !tapped) return;
      api.armFilm?.(film);
      let play: Promise<void> | undefined;
      try {
        play = film.play();
      } catch {
        askForTap();
        return;
      }
      play?.catch?.(() => {
        if (Date.now() - startedAt >= hold) askForTap();
      });
    }

    function openHouse() {
      if (opened) return;
      opened = true;
      setGated(false);
      document.body.classList.remove("is-gated");
      if (intro) {
        setIntroOut(true);
        setTimer(() => setIntroGone(true), outMs);
      }
    }

    function settle() {
      if (opened || !rolling) return;
      const wait = hold - (Date.now() - startedAt);
      if (wait <= 0) openHouse();
      else setTimer(openHouse, wait);
    }

    function enterFromTap() {
      tapped = true;
      held = false;
      ignite();
      openHouse();
    }

    document.body.classList.add("is-gated");

    let cleanupFilm: (() => void) | undefined;
    if (film) {
      if (forceTap) {
        film.removeAttribute("autoplay");
        film.pause();
      }
      const onTimeUpdate = () => {
        if (rolling || film.currentTime < 0.05) return;
        rolling = true;
        settle();
      };
      film.addEventListener("timeupdate", onTimeUpdate);
      film.addEventListener("playing", syncPauseBtn);
      film.addEventListener("pause", syncPauseBtn);

      cleanupFilm = () => {
        film.removeEventListener("timeupdate", onTimeUpdate);
        film.removeEventListener("playing", syncPauseBtn);
        film.removeEventListener("pause", syncPauseBtn);
      };
    }

    let cleanupIntro: (() => void) | undefined;
    if (intro) {
      const onTouchEnd = (e: TouchEvent) => {
        e.preventDefault();
        enterFromTap();
      };
      const onClick = () => enterFromTap();
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          enterFromTap();
        }
      };
      intro.addEventListener("touchend", onTouchEnd, { passive: false });
      intro.addEventListener("click", onClick);
      intro.addEventListener("keydown", onKeyDown);
      cleanupIntro = () => {
        intro.removeEventListener("touchend", onTouchEnd);
        intro.removeEventListener("click", onClick);
        intro.removeEventListener("keydown", onKeyDown);
      };
    }

    const onDocKeyDown = (e: KeyboardEvent) => {
      if (!opened && e.key === "Escape") enterFromTap();
    };
    document.addEventListener("keydown", onDocKeyDown);

    let onPauseDown: ((e: PointerEvent) => void) | undefined;
    let onPauseClick: ((e: MouseEvent) => void) | undefined;
    if (pauseBtn) {
      onPauseDown = (e) => e.stopPropagation();
      onPauseClick = (e) => {
        e.stopPropagation();
        if (filmPlaying()) {
          held = true;
          film?.pause();
        } else {
          held = false;
          ignite();
        }
        syncPauseBtn();
      };
      pauseBtn.addEventListener("pointerdown", onPauseDown);
      pauseBtn.addEventListener("click", onPauseClick);
    }

    const section = sectionRef.current;
    const onSectionClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest(".pause")) return;
      if (!filmPlaying()) {
        held = false;
        ignite();
      }
    };
    section?.addEventListener("click", onSectionClick);

    if (reduce || skipIntro || !intro) {
      if (intro) {
        setIntroOut(true);
        setIntroGone(true);
      }
      openHouse();
    } else {
      setTimer(() => {
        if (!rolling) askForTap();
      }, hold);
    }
    ignite();
    syncPauseBtn();

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      cleanupFilm?.();
      cleanupIntro?.();
      document.removeEventListener("keydown", onDocKeyDown);
      if (pauseBtn && onPauseDown && onPauseClick) {
        pauseBtn.removeEventListener("pointerdown", onPauseDown);
        pauseBtn.removeEventListener("click", onPauseClick);
      }
      section?.removeEventListener("click", onSectionClick);
      document.body.classList.remove("is-gated");
    };
    // Runs once on mount — this is a one-shot ignition sequence, not
    // something that should re-run on a dependency change.
  }, []);

  return (
    <>
      <noscript>
        {/* Without JS, is-gated never gets added to body (that happens in
           the effect below) and the header/hero-copy are already visible
           by default — the curtain itself is the only thing that needs
           hiding, since it blocks the view unconditionally either way. */}
        <style>{`.home-page .intro { display: none !important; }`}</style>
      </noscript>

      {hasIntro && (
        <div
          ref={introRef}
          className={`intro${introOut ? " is-out" : ""}${introGone ? " is-gone" : ""}${needsTap ? " needs-tap" : ""}`}
          role="button"
          tabIndex={introGone ? undefined : 0}
          aria-label="Enter Sweet1NE"
          aria-hidden={introOut ? true : undefined}
        >
          <span className="intro-panel is-top" aria-hidden="true" />
          <span className="intro-panel is-bottom" aria-hidden="true" />
          <span className="intro-seam" aria-hidden="true" />
          <div className="intro-mark">
            <div className="intro-logo" aria-hidden="true" />
            <p className="intro-place">Lewisham · Chingford</p>
          </div>
          <p className="intro-hint">
            <span className="on-touch">Tap to enter</span>
            <span className="on-desk">Click to enter</span>
          </p>
        </div>
      )}

      <section
        ref={sectionRef}
        aria-label="Sweet1NE"
        data-cinema
        className="cinema cinema-fallback relative h-[100svh] min-h-[32rem] overflow-hidden bg-black
          after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:z-[6] after:h-[52%] after:content-['']
          after:bg-[linear-gradient(to_top,#050505_0%,#050505_14%,rgba(5,5,5,0.82)_36%,rgba(5,5,5,0.38)_62%,transparent_100%)]"
      >
        <video
          ref={videoRef}
          className="film block h-full w-full object-cover motion-reduce:hidden"
          style={{ objectPosition: "58% center", pointerEvents: "none" }}
          autoPlay
          muted
          loop
          playsInline
          disablePictureInPicture
          preload="auto"
          poster={POSTER}
        />

        <div className="hero-copy">
          <p className="kicker">Elevated Afro-Caribbean fusion</p>
          <h1>A culinary adventure for all the senses.</h1>
        </div>

        <PromoCard />

        <button
          ref={pauseBtnRef}
          type="button"
          aria-label={playing ? "Pause film" : "Play film"}
          className={[
            "pause bottom-auto top-[4.55rem] z-[9] transition-opacity duration-[450ms] sm:top-[5.4rem]",
            "motion-reduce:hidden",
            gated ? "pointer-events-none opacity-0" : "opacity-100",
          ].join(" ")}
        >
          {playing ? "II" : "▶"}
        </button>
      </section>
    </>
  );
}
