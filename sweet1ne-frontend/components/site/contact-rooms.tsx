"use client";

import { useEffect, useRef, useState } from "react";
import { pickVideoSource } from "@/lib/video-source";

type Room = {
  id: string;
  kicker: string;
  name: string;
  phone: string;
  phoneHref: string;
  address: string;
  mapsUrl: string;
  hours: { days: string; time: string }[];
  video: string;
  videoMobile: string;
  poster: string;
};

const ROOMS: Room[] = [
  {
    id: "lewisham",
    kicker: "Flagship · South East London",
    name: "Lewisham",
    phone: "020 3340 6750",
    phoneHref: "+442033406750",
    address: "2 Loampit Hill, London SE13 7SW",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Sweet1NE+2+Loampit+Hill+London+SE13+7SW",
    hours: [
      { days: "Mon–Tue", time: "Closed" },
      { days: "Wed–Thu", time: "3pm–11pm · kitchen 9.45pm" },
      { days: "Fri–Sun", time: "1pm–11pm · kitchen 9.45pm" },
    ],
    video: "/videos/film-lewisham.mp4",
    videoMobile: "/videos/film-lewisham-mobile.mp4",
    poster: "/images/homepage-gallery/cinematic/poster-lewisham-open.jpg",
  },
  {
    id: "chingford",
    kicker: "East London",
    name: "Chingford",
    phone: "020 3971 3449",
    phoneHref: "+442039713449",
    address: "164 Station Road, Chingford, London E4 6AN",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Sweet1NE+164+Station+Road+Chingford+London+E4+6AN",
    hours: [
      { days: "Mon–Tue", time: "Closed" },
      { days: "Wed–Thu", time: "3pm–11.45pm · kitchen 9.30pm" },
      { days: "Fri–Sat", time: "1pm–11.45pm · kitchen 10.30pm" },
      { days: "Sunday", time: "1pm–11.45pm · kitchen 9.30pm" },
    ],
    video: "/videos/film-chingford.mp4",
    videoMobile: "/videos/film-chingford-mobile.mp4",
    poster: "/images/homepage-gallery/cinematic/poster-chingford.jpg",
  },
];

/**
 * The two rooms, with their numbers over film.
 *
 * Same hover-to-lead mechanism as the homepage, with both rooms filling the
 * viewport so the contact details sit over the atmosphere.
 */
export function ContactRooms() {
  const [lead, setLead] = useState<string>("lewisham");
  const [paused, setPaused] = useState(false);
  const filmsRef = useRef<(HTMLVideoElement | null)[]>([]);

  // Play only while in view — two autoplaying films off-screen is a lot of
  // wasted bandwidth on a phone.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const film = entry.target.querySelector("video");
          if (!film || paused) return;

          if (entry.isIntersecting) film.play().catch(() => {});
          else film.pause();
        });
      },
      { threshold: 0.35 }
    );

    document.querySelectorAll("[data-room-panel]").forEach((panel) => {
      observer.observe(panel);
    });

    return () => observer.disconnect();
  }, [paused]);

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
    <div
      aria-label="How to reach each room"
      className="relative flex min-h-0 flex-col gap-[5px] bg-black pb-[0.8rem] md:flex-row md:gap-[5px] md:pb-[0.8rem]"
    >
      {ROOMS.map((room, i) => {
        const isLead = lead === room.id;

        return (
          <article
            key={room.id}
            data-room-panel
            onMouseEnter={() => {
              if (window.matchMedia("(hover: hover)").matches) setLead(room.id);
            }}
            // Stacked on a phone, each panel is a block with a real minimum
            // height — the film is absolutely positioned, so without one the
            // panel has no content height of its own and collapses to
            // nothing. The flex sizing only applies once they sit side by
            // side, which is also the only place hover-to-lead exists.
            className="panel relative min-h-[26rem] min-w-0 overflow-hidden bg-black md:min-h-[36rem] md:shrink md:basis-0 md:[flex-grow:var(--grow)] md:transition-[flex-grow] md:duration-[850ms] md:ease-[cubic-bezier(0.4,0,0.2,1)]"
            // flex-grow as a number rather than the `flex` shorthand — it
            // interpolates reliably, where the shorthand doesn't.
            style={{ "--grow": isLead ? 1.4 : 0.8 } as React.CSSProperties}
          >
            <video
              ref={(el) => {
                filmsRef.current[i] = el;
                if (!el) return;
                el.muted = true;
                el.defaultMuted = true;
                // Already set by the inline script on a fresh load; this
                // is for client-side navigation, where there's no HTML.
                const wanted = pickVideoSource(room);
                if (!el.src.endsWith(wanted)) el.src = wanted;
              }}
              suppressHydrationWarning
              muted
              loop
              playsInline
              preload="auto"
              autoPlay
              poster={room.poster}
              // The "stepped back" dimming is a hover effect, so it only
              // applies where the panels sit side by side. On a phone
              // there's no hover — Chingford would just be permanently
              // darker than Lewisham for no reason the visitor can see.
              className="film absolute inset-0 h-full w-full scale-[1.04] object-cover [filter:brightness(0.5)_saturate(0.9)] md:[filter:var(--film)] md:transition-[filter] md:duration-[850ms] md:ease-out"
              style={
                {
                  "--film": isLead
                    ? "brightness(0.5) saturate(0.9)"
                    : "brightness(0.34) saturate(0.8)",
                } as React.CSSProperties
              }
            />
            <span
              aria-hidden
              className="shade absolute inset-0"
              style={{
                background:
                  "linear-gradient(to top, rgba(5,5,5,.92) 0%, rgba(5,5,5,.35) 55%, rgba(5,5,5,.15) 100%)",
              }}
            />

            <div className="card relative z-[2] px-[1.05rem] pb-[1.35rem] pt-[6.5rem] sm:px-[1.4rem] sm:pb-[1.45rem] sm:pt-[7.5rem]">
              <p className="mb-1.5 text-[0.66rem] uppercase tracking-[0.18em] text-[var(--gold)]">
                {room.kicker}
              </p>

              <h2 className="mb-[0.85rem] font-display text-[clamp(1.85rem,4.4vw,2.7rem)] font-medium leading-[1.05] tracking-[-0.02em]">
                {room.name}
              </h2>

              {/* The number set large — the most-used thing on any contact
                  page, and a proper tap target. */}
              
               <a href={`tel:${room.phoneHref}`}
                className="phone mb-[0.55rem] inline-block border-b border-[rgba(201,162,74,.55)] pb-[0.12rem] font-display text-[clamp(1.15rem,2.4vw,1.45rem)] tracking-[0.04em] text-[var(--ivory)] transition-colors hover:text-[var(--gold)]"
              >
                {room.phone}
              </a>

              <address className="mb-[0.35rem] max-w-[16rem] text-[0.88rem] not-italic text-[var(--ivory)]">
                {room.address}
              </address>

              
              <a  href={room.mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="maps mb-[0.95rem] inline-block text-[0.68rem] uppercase tracking-[0.14em] text-[var(--ivory)] transition-colors hover:text-[var(--gold)]"
              >
                Maps
              </a>

              <dl className="hours grid w-full max-w-[22rem] grid-cols-[5.6rem_1fr] gap-x-3 gap-y-[0.12rem] text-[0.78rem]">
                {room.hours.map((row) => {
                  const closed = row.time === "Closed";

                  return (
                    <div key={row.days} className="contents">
                      <dt className="whitespace-nowrap text-[0.68rem] font-semibold text-[var(--gold)]">
                        {row.days}
                      </dt>
                      <dd className={closed ? "text-[var(--muted)]" : "text-[var(--ivory-dim)]"}>
                        {row.time}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          </article>
        );
      })}

      <button
        type="button"
        onClick={togglePause}
        aria-label={paused ? "Play films" : "Pause films"}
        className="pause absolute right-[0.75rem] top-[0.65rem] z-10 grid h-[2.35rem] w-[2.35rem] place-items-center rounded-full border border-[rgba(201,162,74,.55)] bg-[rgba(5,5,5,.55)] text-[0.68rem] text-[var(--ivory)] backdrop-blur transition-colors hover:border-[var(--gold)] motion-reduce:hidden md:right-[0.85rem] md:top-[0.75rem]"
      >
        {paused ? "▶" : "II"}
      </button>
    </div>
  );
}