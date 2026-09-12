"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

const JUMPS = [
  { href: "#table", label: "A table" },
  { href: "#hire", label: "The room" },
  { href: "#next", label: "What's next" },
];

const PATHS = [
  {
    id: "table",
    href: "/locations",
    image: "/images/homepage-gallery/events/night-table.jpg",
    heading: "Take a table.",
    body: "A night in the room — brunch, a celebration, people you actually want.",
  },
  {
    id: "hire",
    href: "/contact#write",
    image: "/images/homepage-gallery/events/night-room.jpg",
    heading: "Take the room.",
    body: "Private hire. Write to us — same people who take the bookings.",
  },
];

/**
 * Two ways in: a table for the night, or the whole room.
 *
 * Unlike the order page's emblems these are links rather than a choice —
 * they lead somewhere rather than revealing a next step.
 */
export function EventsPaths() {
  const [current, setCurrent] = useState("#table");
  const [lead, setLead] = useState<string>("table");

  return (
    <>
      <nav
        aria-label="Events"
        className="sticky top-[3.7rem] z-30 grid w-full grid-cols-3 border-b border-[rgba(201,162,74,.14)] bg-[rgba(5,5,5,.96)] sm:top-[4.15rem]"
      >
        {JUMPS.map((jump) => {
          const isOn = current === jump.href;

          return (
            <a
              key={jump.href}
              href={jump.href}
              onClick={() => setCurrent(jump.href)}
              aria-current={isOn ? "location" : undefined}
              className={`min-w-0 px-[0.4rem] py-[0.95rem] text-center text-[0.68rem] uppercase tracking-[0.14em] transition-colors sm:py-[0.85rem] ${
                isOn
                  ? "text-[var(--gold)] shadow-[inset_0_-2px_0_var(--gold)]"
                  : "text-[var(--ivory-dim)] hover:text-[var(--ivory)]"
              }`}
            >
              {jump.label}
            </a>
          );
        })}
      </nav>

      <div
        id="table"
        className="flex flex-col items-center gap-[1.8rem] px-[1.15rem] py-[2.4rem] sm:px-6 lg:flex-row lg:items-end lg:justify-center lg:gap-[2.2rem] lg:px-8"
      >
        {PATHS.map((path, i) => {
          const isLead = lead === path.id;

          return (
            <Link
              key={path.id}
              // The second emblem carries the #hire anchor the jump bar
              // points at.
              id={path.id === "hire" ? "hire" : undefined}
              href={path.href}
              onMouseEnter={() => {
                if (window.matchMedia("(hover: hover)").matches) setLead(path.id);
              }}
              className={`block w-full max-w-[22rem] scroll-mt-32 text-center transition-opacity duration-[650ms] lg:max-w-[22rem] lg:flex-1 ${
                isLead ? "opacity-100" : "opacity-60 hover:opacity-85"
              } ${i === 0 ? "md:translate-y-[0.7rem]" : "md:-translate-y-[0.35rem]"}`}
            >
              <span
                className={`relative mx-auto block aspect-square overflow-hidden rounded-full transition-all duration-[650ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${
                  isLead ? "w-[min(86vw,22rem)] lg:w-full" : "w-[min(86vw,22rem)] lg:w-full"
                }`}
                style={{
                  boxShadow: isLead
                    ? "0 0 0 2px var(--gold)"
                    : "0 0 0 1px rgba(201,162,74,.35)",
                }}
              >
                <Image
                  src={path.image}
                  alt=""
                  fill
                  sizes="(max-width: 720px) 86vw, 352px"
                  quality={100}
                  className="object-cover"
                />
              </span>

              <h2 className="mt-5 font-display text-[1.35rem] font-medium leading-tight sm:text-[1.6rem]">
                {path.heading}
              </h2>

              <p className="mx-auto mt-2 max-w-[20rem] text-[0.92rem] leading-relaxed text-[var(--ivory-dim)]">
                {path.body}
              </p>
            </Link>
          );
        })}
      </div>
    </>
  );
}