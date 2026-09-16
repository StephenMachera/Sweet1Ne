"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BEATS } from "@/lib/home-content";
import { useStage } from "./stage-provider";

type FilmsApi = {
  armFilm?: (v: HTMLVideoElement) => void;
  kickFilm?: (v: HTMLVideoElement) => void;
  bindFilmUnlock?: (getFilms: () => (HTMLVideoElement | null)[]) => void;
};

declare global {
  interface Window {
    sweet1neFilms?: FilmsApi;
  }
}

const BEAT_MS = 9000;

export default function Cinema() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const beatRefs = useRef<(HTMLDivElement | null)[]>([]);
  const heldRef = useRef(false);
  const beatRef = useRef(0);

  const [beat, setBeat] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [reduce, setReduce] = useState(false);
  const [phone, setPhone] = useState(false);

  const { enter, setHeaderSolid, registerPlay, gated } = useStage();

  useEffect(() => {
    setReduce(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    setPhone(window.matchMedia("(max-width: 720px)").matches);
  }, []);

  const allFilms = useCallback(
    () => Array.from(sectionRef.current?.querySelectorAll<HTMLVideoElement>(".film") ?? []),
    []
  );

  const visibleFilm = useCallback((): HTMLVideoElement | null => {
    const on = beatRefs.current[beatRef.current] ?? beatRefs.current[0];
    if (!on) return null;
    const shown = Array.from(on.querySelectorAll<HTMLVideoElement>(".film")).filter(
      (film) => window.getComputedStyle(film).display !== "none"
    );
    return shown[0] ?? on.querySelector<HTMLVideoElement>(".film");
  }, []);

  const filmPlaying = useCallback(() => {
    const lead = visibleFilm();
    return !!(lead && !lead.paused && lead.readyState > 1);
  }, [visibleFilm]);

  const playCinema = useCallback(() => {
    if (heldRef.current || reduce) return;
    const api = window.sweet1neFilms ?? {};
    const lead = visibleFilm();

    if (lead) {
      lead.muted = true;
      lead.defaultMuted = true;
      lead.playsInline = true;
      lead.setAttribute("playsinline", "");
      lead.setAttribute("webkit-playsinline", "");
      if (api.kickFilm) api.kickFilm(lead);
      else void lead.play().catch(() => {});
    }

    allFilms().forEach((film) => {
      if (film === lead) return;
      if (window.getComputedStyle(film).display === "none") return;
      if (phone) film.pause();
      else if (api.kickFilm) api.kickFilm(film);
      else void film.play().catch(() => {});
    });
  }, [allFilms, phone, reduce, visibleFilm]);

  // let the gate trigger playback inside its own gesture
  useEffect(() => {
    registerPlay(playCinema);
    return () => registerPlay(null);
  }, [playCinema, registerPlay]);

  // arm films + keep the pause button label honest
  useEffect(() => {
    const api = window.sweet1neFilms ?? {};
    const films = allFilms();
    const sync = () => setPlaying(filmPlaying());

    films.forEach((film) => {
      api.armFilm?.(film);
      film.addEventListener("playing", sync);
      film.addEventListener("pause", sync);
    });

    api.bindFilmUnlock?.(() =>
      heldRef.current || reduce ? [] : phone ? [visibleFilm()] : films
    );

    sync();
    return () => {
      films.forEach((film) => {
        film.removeEventListener("playing", sync);
        film.removeEventListener("pause", sync);
      });
    };
  }, [allFilms, filmPlaying, phone, reduce, visibleFilm]);

  // rotate beats
  useEffect(() => {
    if (reduce || BEATS.length < 2) return;
    playCinema();
    const id = window.setInterval(() => {
      if (heldRef.current) return;
      beatRef.current = (beatRef.current + 1) % BEATS.length;
      setBeat(beatRef.current);
      const next = visibleFilm();
      if (next && phone) next.preload = "auto";
      playCinema();
    }, BEAT_MS);
    return () => window.clearInterval(id);
  }, [phone, playCinema, reduce, visibleFilm]);

  // solid header once the hero is mostly out of view
  useEffect(() => {
    const node = sectionRef.current;
    if (!node || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      ([entry]) => setHeaderSolid(!entry.isIntersecting),
      { threshold: 0.48 }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [setHeaderSolid]);

  const togglePause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (filmPlaying()) {
      heldRef.current = true;
      allFilms().forEach((film) => film.pause());
    } else {
      heldRef.current = false;
      playCinema();
    }
    setPlaying(filmPlaying());
  };

  const onSectionClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".pause")) return;
    if (!filmPlaying()) {
      heldRef.current = false;
      enter();
    }
  };

  return (
    <section
      ref={sectionRef}
      aria-label="Sweet1NE"
      // The site header (rendered by the layout, outside StageProvider)
      // watches this to know when it has scrolled past the film.
      data-cinema
      onClick={onSectionClick}
      className="cinema cinema-fallback relative h-[100svh] min-h-[32rem] overflow-hidden bg-black
        after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:z-[6] after:h-[52%] after:content-['']
        after:bg-[linear-gradient(to_top,#050505_0%,#050505_14%,rgba(5,5,5,0.82)_36%,rgba(5,5,5,0.38)_62%,transparent_100%)]"
    >
      {BEATS.map((b, i) => (
        <div
          key={b.id}
          ref={(el) => {
            beatRefs.current[i] = el;
          }}
          className={[
            "absolute inset-0 transition-opacity duration-[1600ms] ease-out",
            i === beat ? "opacity-100" : "opacity-0",
          ].join(" ")}
        >
          {b.sources.map((source) => (
            <video
              key={source.src}
              className={[
                "film block h-full w-full object-cover motion-reduce:hidden",
                source.only === "desktop" ? "max-[720px]:hidden" : "",
                source.only === "phone" ? "hidden max-[720px]:block" : "",
              ].join(" ")}
              style={{ objectPosition: source.objectPosition, pointerEvents: "none" }}
              src={source.src}
              poster={source.poster}
              preload={source.preload}
              autoPlay={i === 0}
              muted
              loop
              playsInline
              disablePictureInPicture
            />
          ))}
        </div>
      ))}

      {/* `hero-copy` is what the template's rules key on — the placement, the
          gold hairline above the kicker, and the Bodoni setting of the
          headline all come from .home-page .hero-copy in site.css. The
          Tailwind that was here duplicated the positioning but left the h1
          with no font-family at all, so it rendered in the body face. It
          also broke at 640px where the template breaks at 720px. */}
      <div className="hero-copy">
        <p className="kicker">Elevated Afro-Caribbean fusion</p>
        <h1>A culinary adventure for all the senses.</h1>
      </div>

      <button
        type="button"
        onClick={togglePause}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={playing ? "Pause films" : "Play films"}
        className={[
          "pause bottom-auto top-[4.55rem] z-[9] transition-opacity duration-[450ms] sm:top-[5.4rem]",
          "motion-reduce:hidden",
          gated ? "pointer-events-none opacity-0" : "opacity-100",
        ].join(" ")}
      >
        {playing ? "II" : "▶"}
      </button>
    </section>
  );
}