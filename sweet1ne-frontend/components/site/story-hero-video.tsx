"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The story page's hero background — same pattern as the homepage Hero:
 * a poster image underneath for an instant paint and a graceful fallback,
 * with the video fading in on top once it can actually play.
 */
export function StoryHeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Anyone who's asked for less motion keeps the poster instead.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const onCanPlay = () => setReady(true);
    video.addEventListener("canplaythrough", onCanPlay);

    // Autoplay can still be refused despite being muted — if it is, the
    // poster simply stays, which is a perfectly good hero.
    video.play().catch(() => {});

    return () => video.removeEventListener("canplaythrough", onCanPlay);
  }, []);

  return (
    <video
      ref={videoRef}
      muted
      loop
      // Without this, iOS opens the video fullscreen instead of inline.
      playsInline
      preload="metadata"
      poster="/images/story/hero.jpg"
      className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
        ready ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Smaller encode first — the browser takes the first source whose
          media query matches, so phones never fetch the large file. */}
      <source src="/videos/story-hero-mobile.mp4" type="video/mp4" media="(max-width: 768px)" />
      <source src="/videos/story-hero.mp4" type="video/mp4" />
    </video>
  );
}
