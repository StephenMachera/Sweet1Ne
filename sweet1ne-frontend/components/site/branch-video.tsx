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

    const onCanPlay = () => setReady(true);
    video.addEventListener("canplaythrough", onCanPlay);

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
      video.removeEventListener("canplaythrough", onCanPlay);
    };
  }, []);

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
    >
      {/* The browser takes the first source whose media query matches. */}
      <source src={mobileSrc} type="video/mp4" media="(max-width: 768px)" />
      <source src={src} type="video/mp4" />
    </video>
  );
}
