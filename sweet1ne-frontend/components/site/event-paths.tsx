"use client";

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
  return (
    <>
      <nav
        aria-label="Events"
        className="sticky top-[3.7rem] z-30 grid w-full grid-cols-3 border-b border-[rgba(201,162,74,.14)] bg-[rgba(5,5,5,.96)] sm:top-[4.15rem]"
      >
        {JUMPS.map((jump) => {
          return (
            <a
              key={jump.href}
              href={jump.href}
              className="min-w-0 px-[0.4rem] py-[0.95rem] text-center text-[0.68rem] uppercase tracking-[0.14em] text-[var(--ivory-dim)] transition-colors hover:text-[var(--ivory)] sm:py-[0.85rem]"
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
        {PATHS.map((path, i) => (
            <Link
              key={path.id}
              // The second emblem carries the #hire anchor the jump bar
              // points at.
              id={path.id === "hire" ? "hire" : undefined}
              href={path.href}
              className={`emblem block w-full max-w-[22rem] scroll-mt-32 text-center text-inherit lg:max-w-[22rem] lg:flex-1 ${i === 0 ? "lg:translate-y-[0.7rem]" : "lg:-translate-y-[0.35rem]"}`}
            >
              <span
                className="disc relative mx-auto mb-4 block aspect-square w-[min(86vw,22rem)] max-w-[22rem] overflow-hidden rounded-full bg-[#111] shadow-[0_0_0_1px_rgba(201,162,74,0.42)] transition-[box-shadow,transform] duration-[450ms] ease-out hover:scale-[1.03] hover:shadow-[0_0_0_2px_var(--gold)] lg:w-full"
              >
                <Image
                  src={path.image}
                  alt=""
                  fill
                  sizes="(max-width: 720px) 86vw, 352px"
                  quality={100}
                  className="object-cover transition-transform duration-[1150ms] ease-out hover:scale-[1.07]"
                  style={{ objectPosition: path.id === "table" ? "48% 32%" : "50% 48%" }}
                />
              </span>

              <h2 className="mt-5 font-display text-[1.35rem] font-medium leading-tight sm:text-[1.6rem]">
                {path.heading}
              </h2>

              <p className="mx-auto mt-2 max-w-[20rem] text-[0.92rem] leading-relaxed text-[var(--ivory-dim)]">
                {path.body}
              </p>
            </Link>
        ))}
      </div>
    </>
  );
}