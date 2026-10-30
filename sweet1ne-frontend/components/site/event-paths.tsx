"use client";

import { useState } from "react";
import Link from "next/link";

const JUMPS = [
  { href: "#table", label: "A table" },
  { href: "#hire", label: "Private hire" },
  { href: "#next", label: "What’s next" },
];

const PATHS = [
  {
    id: "table",
    href: "/locations",
    image: "/images/homepage-gallery/events/night-table.jpg",
    heading: "Take a table.",
    body: "Brunch, a birthday, or dinner. Book Lewisham or Chingford.",
  },
  {
    id: "room",
    href: "/contact#write",
    image: "/images/homepage-gallery/events/night-room.jpg",
    heading: "Private hire.",
    body: "Write to us. Same people who take the bookings.",
  },
];

/**
 * The jump bar and the two ways in — a table for the night, or the room.
 *
 * Unlike the order page's emblems these are links rather than a choice:
 * they lead somewhere rather than revealing a next step. Class names are
 * events.html's; the styling lives under .events-page in site.css.
 */
export function EventsPaths() {
  const [current, setCurrent] = useState<string | null>(null);

  return (
    <>
      <nav className="jump" aria-label="Events">
        {JUMPS.map((jump) => (
          <a
            key={jump.href}
            href={jump.href}
            aria-current={current === jump.href ? "location" : undefined}
            onClick={() => setCurrent(jump.href)}
          >
            {jump.label}
          </a>
        ))}
      </nav>

      <div className="paths" id="table">
        {PATHS.map((path) => (
          <Link
            key={path.id}
            href={path.href}
            className="emblem"
            data-path={path.id}
            // The second emblem carries the #hire anchor the jump bar
            // points at.
            id={path.id === "room" ? "hire" : undefined}
          >
            <span className="disc">
              {/* A plain img, as in the template — a Next fill image would
                  need its own positioned box and buys nothing here. */}
              <img src={path.image} alt="" />
            </span>
            <h2>{path.heading}</h2>
            <p>{path.body}</p>
          </Link>
        ))}
      </div>

      {/* A third, lighter-weight way in — no emblem photo for this one,
          since it's off-site rather than a page on the gallery's own
          events-night imagery. */}
      <p className="mt-2 text-center">
        <a
          href="https://sweet1nelive.com/"
          target="_blank"
          rel="noreferrer"
          className="inline-block rounded-[4px] border border-[rgba(201,162,74,.9)] px-6 py-3 text-sm font-semibold text-[var(--gold)] transition-colors hover:bg-[var(--gold)] hover:text-[#0e0e0e]"
        >
          Go live
        </a>
      </p>
    </>
  );
}
