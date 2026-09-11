"use client";

import { useEffect, useRef, useState } from "react";

export type BranchVideoSources = {
  /** Poster paints instantly and is what stays if the video never plays. */
  poster: string;
  src: string;
  /** Smaller encode phones take instead — they never fetch the large file. */
  mobileSrc: string;
};

/**
 * A looping, silent background video for a branch card.
 *
 * Same poster-then-fade pattern as the heroes, with one difference: this
 * sits partway down a page rather than at the top, so it only starts
 * fetching and playing once it's actually on screen, and pauses again when
 * it isn't. A 16:9 card shouldn't cost a phone several megabytes of video
 * the visitor scrolled straight past.
 */
export function BranchVideo({ poster, src, mobileSrc }: BranchVideoSources) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Anyone who's asked for less motion keeps the poster instead.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // The source is chosen here rather than with <source media="…">: Chrome
    // and Firefox ignore `media` on a <source> inside <video> (it only
    // works inside <picture>), so they'd always take whichever file was
    // listed first regardless of screen size. Nothing is fetched until
    // play() is called below, so assigning it up front costs nothing.
    video.src = window.matchMedia("(max-width: 768px)").matches ? mobileSrc : src;

    // Fade in on `playing`, not `canplaythrough`: iOS Safari doesn't buffer
    // ahead, so canplaythrough often never fires there and the video would
    // play on, invisible, behind its own poster. `playing` means frames
    // are actually being rendered — the only thing worth waiting for.
    const onPlaying = () => setReady(true);
    video.addEventListener("playing", onPlaying);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Autoplay can still be refused despite being muted — if it is,
          // the poster simply stays, which is a perfectly good card.
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: 0.25 }
    );
    observer.observe(video);

    return () => {
      observer.disconnect();
      video.removeEventListener("playing", onPlaying);
    };
  }, [src, mobileSrc]);

  return (
    <video
      ref={videoRef}
      muted
      loop
      // Without this, iOS opens the video fullscreen instead of inline.
      playsInline
      // Nothing is fetched until play() is called from the observer above.
      preload="none"
      poster={poster}
      className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
        ready ? "opacity-100" : "opacity-0"
      }`}
    />
  );
}
