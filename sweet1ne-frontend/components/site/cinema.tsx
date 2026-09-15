"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Two films, crossfading — built to the locked home.html.
 *
 * Night (the Events dancer) starts on; the Chingford room sits underneath
 * and dissolves in every nine seconds. The rules that make it autoplay on a
 * phone, in order of how easy they are to break:
 *
 *  - Every film ships autoplay / muted / playsinline / webkit-playsinline
 *    in the served HTML, so a phone doesn't wait for React.
 *  - A small inline script directly under the cinema kicks the visible film
 *    the moment the parser reaches it — before hydration.
 *  - On a phone only the visible beat plays; the film underneath is paused.
 *    Two simultaneous play() calls are what stop an iPhone.
 *  - play() is re-kicked on canplay, pointerdown, touchstart, pageshow and
 *    on the tab becoming visible again. Nothing ever calls load().
 *  - Below 720px the room beat swaps to a separate mobile-encode <video>
 *    via CSS display, not <source media> (Chrome ignores that in <video>).
 */

const POSTER_NIGHT = "/images/homepage-gallery/events/poster-events.jpg";
const POSTER_ROOM = "/images/homepage-gallery/cinematic/poster-chingford-open.jpg";

const BEAT_EVERY_MS = 9000;
const PHONE_QUERY = "(max-width: 720px)";

/* What site.js does for the static pages: make a film eligible to autoplay
   on every browser, then ask it to. */
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

/* Runs as the parser reaches it, well before React. Plays whatever film is
   on and actually displayed — on a phone that's the Events film alone. */
const INLINE_KICK = `(function(){if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;document.querySelectorAll(".cinema .beat.is-on video").forEach(function(v){if(window.getComputedStyle(v).display==="none")return;v.muted=true;v.defaultMuted=true;v.playsInline=true;var p=v.play();if(p&&p.catch)p.catch(function(){});});})();`;

export function Cinema({ gated }: { gated: boolean }) {
  const [held, setHeld] = useState(false);
  const cinemaRef = useRef<HTMLElement>(null);

  // Everything the template's page script does, kept in refs so the
  // listeners registered once at mount always see the current state.
  const beatRef = useRef(0);
  const heldRef = useRef(false);
  heldRef.current = held;

  useEffect(() => {
    const cinema = cinemaRef.current;
    if (!cinema) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const phone = window.matchMedia(PHONE_QUERY).matches;
    const films = Array.from(cinema.querySelectorAll<HTMLVideoElement>(".film"));
    const beats = Array.from(cinema.querySelectorAll<HTMLElement>(".beat"));

    const shown = (film: HTMLVideoElement) =>
      window.getComputedStyle(film).display !== "none";

    function visibleFilm(): HTMLVideoElement | null {
      const on = beats[beatRef.current] || beats[0];
      if (!on) return null;
      const candidates = Array.from(on.querySelectorAll<HTMLVideoElement>(".film"));
      return candidates.find(shown) || candidates[0] || null;
    }

    function playCinema() {
      if (heldRef.current || reduce) return;
      const lead = visibleFilm();
      if (lead) kickFilm(lead);

      films.forEach((film) => {
        if (film === lead) return;
        // A phone gets one film at a time; a laptop can run both so the
        // dissolve lands on a film that's already moving. A film CSS has
        // hidden for this screen is paused outright — home.html skipped
        // those, which left the desktop encode running underneath the
        // Events film on a phone, exactly the double play() it warns about.
        if (phone || !shown(film)) film.pause();
        else kickFilm(film);
      });
    }

    // The lead film is already playing by now — the `autoplay` attribute
    // and the inline script under the cinema saw to that before React
    // loaded. Nothing here calls play() on it; this only quietens the films
    // that shouldn't be running on this screen and wires the re-kicks.
    const lead = visibleFilm();
    films.forEach((film) => {
      if (film !== lead && (phone || !shown(film))) film.pause();
      film.addEventListener("canplay", playCinema);
    });

    let timer: number | undefined;
    if (!reduce) {
      timer = window.setInterval(() => {
        if (heldRef.current || beats.length < 2) return;
        const next = (beatRef.current + 1) % beats.length;
        beatRef.current = next;
        beats.forEach((el, i) => el.classList.toggle("is-on", i === next));
        // The phone encode was left at preload="none" so it cost nothing
        // until now; from here it's the one that has to be ready.
        const film = visibleFilm();
        if (film && phone) film.preload = "auto";
        playCinema();
      }, BEAT_EVERY_MS);
    }

    // The unlock: any gesture, or the page coming back, re-kicks the films
    // that should be playing. A tap on the gate counts, which is the point.
    const unlock = () => {
      if (heldRef.current || reduce) return;
      const list = phone ? [visibleFilm()] : films.filter(shown);
      list.forEach((film) => film && kickFilm(film));
    };
    const onVisible = () => {
      if (!document.hidden) unlock();
    };
    document.addEventListener("pointerdown", unlock, { passive: true });
    document.addEventListener("touchstart", unlock, { passive: true });
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", unlock);

    return () => {
      if (timer !== undefined) window.clearInterval(timer);
      films.forEach((film) => film.removeEventListener("canplay", playCinema));
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("touchstart", unlock);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", unlock);
    };
  }, []);

  function togglePause() {
    const cinema = cinemaRef.current;
    const next = !held;
    heldRef.current = next;
    setHeld(next);
    if (!cinema) return;

    const films = Array.from(cinema.querySelectorAll<HTMLVideoElement>(".film"));
    if (next) {
      films.forEach((film) => film.pause());
      return;
    }
    const phone = window.matchMedia(PHONE_QUERY).matches;
    const on = cinema.querySelectorAll<HTMLElement>(".beat")[beatRef.current];
    films.forEach((film) => {
      const displayed = window.getComputedStyle(film).display !== "none";
      if (!displayed) return;
      if (phone && !on?.contains(film)) return;
      kickFilm(film);
    });
  }

  return (
    <>
      <section
        ref={cinemaRef}
        aria-label="Sweet1NE"
        className="cinema"
        data-cinema
      >
        {/* Classes here are static on purpose. The on-beat is switched with
            classList in the effect, never through React state, so a beat
            change (or the pause toggle, or hydration) never re-renders a
            <video>. Tried injecting these as raw HTML instead: React 19
            rebuilds a dangerouslySetInnerHTML subtree at hydration, which
            restarted films that were already playing. */}
        <div className="beat beat-night is-on">
          <video
            className="film"
            autoPlay
            muted
            loop
            playsInline
            webkit-playsinline="true"
            disablePictureInPicture
            preload="auto"
            poster={POSTER_NIGHT}
          >
            {/* WebM first: a third fewer bytes to the first frame. The browser
                takes the first source whose type it can play, so anything
                without VP9 (older iOS) falls through to the MP4. */}
            <source src="/videos/film-events.webm" type="video/webm" />
            <source src="/videos/film-events.mp4" type="video/mp4" />
          </video>
        </div>

        <div className="beat beat-room">
          <video
            className="film film-desk"
            autoPlay
            muted
            loop
            playsInline
            webkit-playsinline="true"
            disablePictureInPicture
            preload="auto"
            poster={POSTER_ROOM}
          >
            <source src="/videos/film-chingford.mp4" type="video/mp4" />
          </video>
          {/* The phone encode. No autoplay and nothing preloaded — hidden
              until 720px, paused until its beat comes round. */}
          <video
            className="film film-phone"
            muted
            loop
            playsInline
            webkit-playsinline="true"
            disablePictureInPicture
            preload="none"
            poster={POSTER_ROOM}
          >
            <source src="/videos/film-chingford-mobile.mp4" type="video/mp4" />
          </video>
        </div>

        {/* Reduced motion gets a still rather than film — the fallback is a
            poster, not an empty black panel. */}
        <div
          aria-hidden
          className="absolute inset-0 hidden bg-cover bg-no-repeat motion-reduce:block"
          style={{
            backgroundImage: `url('${POSTER_ROOM}')`,
            backgroundPosition: "58% center",
          }}
        />

        <div className="hero-copy">
          <p className="kicker">Elevated Afro-Caribbean fusion</p>
          <h1>A culinary adventure for all the senses.</h1>
        </div>

        <button
          type="button"
          className="pause"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={togglePause}
          aria-label={held ? "Play films" : "Pause films"}
          style={{
            opacity: gated ? 0 : 1,
            pointerEvents: gated ? "none" : "auto",
          }}
        >
          {held ? "▶" : "II"}
        </button>
      </section>

      {/* Directly under the cinema, as in home.html — this is what starts
          the film on a phone before React has loaded. */}
      <script dangerouslySetInnerHTML={{ __html: INLINE_KICK }} />
    </>
  );
}
