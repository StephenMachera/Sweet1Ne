"use client";

import { useEffect, useRef, useState } from "react";

const POSTER = "/images/homepage-gallery/events/poster-events.jpg";
const FILM = "/videos/film-events.mp4";

/* Runs as the parser reaches it, before React — the film is asked to play
   the moment the tag exists, which is what a phone needs. */
const INLINE_KICK = `(function(){if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;var v=document.querySelector(".events-page .hero .film");if(!v)return;v.muted=true;v.defaultMuted=true;v.playsInline=true;var p=v.play();if(p&&p.catch)p.catch(function(){});})();`;

function armFilm(film: HTMLVideoElement) {
  film.muted = true;
  film.defaultMuted = true;
  film.playsInline = true;
  film.setAttribute("autoplay", "");
  film.setAttribute("muted", "");
  film.setAttribute("playsinline", "");
  film.setAttribute("webkit-playsinline", "");
}

function kickFilm(film: HTMLVideoElement) {
  armFilm(film);
  try {
    const play = film.play();
    if (play && typeof play.catch === "function") play.catch(() => {});
  } catch {
    /* an old WebKit throws synchronously; nothing to do */
  }
}

/**
 * The night, as a portrait film on a gold-edged stage — built to events.html.
 *
 * The file sits on the <video src>, not a nested <source>: Safari is
 * unreliable with the latter. It ships autoplay/muted/playsinline/
 * webkit-playsinline in the HTML and is kicked by the inline script under
 * it, so nothing waits for React. Afterwards it's re-kicked on canplay, on
 * any gesture (Safari counts pointerup, touchend, click and keys — not
 * pointerdown), on pageshow and when the tab comes back; a tap on the
 * stage plays a film Safari refused to start; and it pauses off-screen.
 * The pause control reads the film's real state, so it's never showing
 * "pause" over a film that isn't moving.
 */
export function EventsHero() {
  const filmRef = useRef<HTMLVideoElement>(null);
  const heldRef = useRef(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const film = filmRef.current;
    if (!film) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sync = () => setPlaying(!film.paused && film.readyState > 1);
    film.addEventListener("playing", sync);
    film.addEventListener("pause", sync);
    sync();

    if (reduce) return () => {
      film.removeEventListener("playing", sync);
      film.removeEventListener("pause", sync);
    };

    const kick = () => {
      if (!heldRef.current) kickFilm(film);
    };

    armFilm(film);
    kick();
    film.addEventListener("canplay", kick);

    const onVisible = () => {
      if (!document.hidden) kick();
    };
    document.addEventListener("pointerup", kick, { passive: true });
    document.addEventListener("touchend", kick, { passive: true });
    document.addEventListener("click", kick, { passive: true });
    document.addEventListener("keydown", kick);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", kick);

    // Off-screen it stops — an autoplaying film nobody can see is just
    // someone's data.
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (heldRef.current) return;
          if (entry.isIntersecting) kick();
          else film.pause();
        });
      },
      { threshold: 0.35 }
    );
    io.observe(film);

    return () => {
      film.removeEventListener("playing", sync);
      film.removeEventListener("pause", sync);
      film.removeEventListener("canplay", kick);
      document.removeEventListener("pointerup", kick);
      document.removeEventListener("touchend", kick);
      document.removeEventListener("click", kick);
      document.removeEventListener("keydown", kick);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", kick);
      io.disconnect();
    };
  }, []);

  function togglePause(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const film = filmRef.current;
    if (!film) return;

    if (!film.paused) {
      heldRef.current = true;
      film.pause();
    } else {
      heldRef.current = false;
      kickFilm(film);
    }
  }

  // A tap anywhere on the stage starts a film that isn't moving — the
  // Safari case, where nothing but a gesture will do.
  function onStageClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest(".pause")) return;
    const film = filmRef.current;
    if (film && film.paused) {
      heldRef.current = false;
      kickFilm(film);
    }
  }

  return (
    <section id="night" aria-label="The night" className="hero">
      <div className="stage" onClick={onStageClick}>
        <video
          ref={filmRef}
          className="film"
          src={FILM}
          autoPlay
          muted
          loop
          playsInline
          webkit-playsinline="true"
          preload="auto"
          poster={POSTER}
        />
        <span className="veil" aria-hidden="true" />
        <button
          type="button"
          className="pause"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={togglePause}
          aria-label={playing ? "Pause film" : "Play film"}
        >
          {playing ? "II" : "▶"}
        </button>
      </div>

      {/* Directly under the stage, as in events.html. */}
      <script dangerouslySetInnerHTML={{ __html: INLINE_KICK }} />

      <div className="hero-copy">
        <p className="kicker">What’s on</p>
        <h1>Nights worth planning around.</h1>
        <p className="dek">Book a table, or hire the restaurant for your own night.</p>
      </div>
    </section>
  );
}
