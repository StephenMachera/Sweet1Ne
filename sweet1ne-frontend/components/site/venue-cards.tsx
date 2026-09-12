"use client";

import Image from "next/image";
import { RESERVATION_URLS } from "@/lib/site-content";
import { VENUES, type Venue } from "@/lib/venues";

export function VenueCards() {
  return (
    <>
      {VENUES.map((venue) => (
        <VenueCard key={venue.id} venue={venue} />
      ))}
    </>
  );
}

function VenueCard({ venue }: { venue: Venue }) {
  return (
    <article
      id={venue.id}
      className="venue scroll-mt-[7.4rem] border-t border-[rgba(229,226,225,.08)] first-of-type:border-0 lg:scroll-mt-[8.2rem]"
    >
      <div className="venue-inner grid w-full lg:grid-cols-[1.15fr_0.85fr]">
        {/* The room, with its name over it. */}
        <div
          className={`stage relative h-[52svh] min-h-[18.5rem] w-full overflow-hidden bg-black lg:h-[calc(100svh-8.4rem)] lg:min-h-[28rem] lg:max-h-[46rem] ${
            venue.id === "lewisham" ? "lg:[&>img]:object-[48%_50%]" : "lg:[&>img]:object-[50%_48%]"
          }`}
        >
          <Image
            src={venue.image}
            alt={venue.alt}
            fill
            sizes="(max-width: 899px) 100vw, 57.5vw"
            className="still object-cover"
          />

          <span
            aria-hidden
            className="shade absolute inset-0"
            style={{
              background:
                "linear-gradient(to top, rgba(5,5,5,.88) 0%, rgba(5,5,5,.1) 52%, transparent 100%)",
            }}
          />

          <div className="stage-copy absolute inset-x-0 bottom-0 z-[1] px-[1.15rem] pb-[1.35rem] pt-5 sm:px-6">
            <p className="mb-1.5 text-[0.66rem] uppercase tracking-[0.18em] text-[var(--gold)]">
              {venue.kicker}
            </p>

            <h2 className="mb-1 font-display text-[clamp(1.9rem,4vw,2.7rem)] font-medium leading-none tracking-[-0.02em]">
              {venue.name}
            </h2>

            <p className="text-[0.92rem] text-[var(--ivory-dim)]">{venue.tagline}</p>
          </div>
        </div>

        {/* The practical half — what someone came here for. */}
        <div className="facts min-w-0 px-5 pb-[2.4rem] pt-5 sm:px-6 lg:flex lg:flex-col lg:justify-center lg:px-[2.4rem] lg:pb-[2.8rem]">
          <p className="cta mb-4">
            {/* This card already names the branch, so asking again in the
                modal would be redundant — straight to its SevenRooms page. */}
            <a
              href={RESERVATION_URLS[venue.id]}
              target="_blank"
              rel="noreferrer"
              className="book block w-full border border-[rgba(201,162,74,.9)] px-[1.1rem] py-4 text-center text-[0.8rem] font-semibold uppercase tracking-[0.12em] text-[var(--gold)] transition-colors hover:bg-[var(--gold)] hover:text-[#0e0e0e] lg:inline-block lg:w-auto lg:py-[0.58rem]"
              style={{ borderRadius: "3px" }}
            >
              Book {venue.name}
            </a>
          </p>

          <div className="quick mb-[1.35rem] grid w-full grid-cols-2 gap-2 lg:max-w-[22rem]">
            <a
              href={`tel:${venue.phoneHref}`}
              className="grid min-h-12 place-items-center border border-[rgba(201,162,74,.4)] px-2 text-center text-[0.68rem] uppercase tracking-[0.12em] text-[var(--ivory)] transition-colors hover:border-[var(--gold)] hover:text-[var(--gold)]"
              style={{ borderRadius: "3px" }}
            >
              Call
            </a>
            <a
              href={venue.mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="grid min-h-12 place-items-center border border-[rgba(201,162,74,.4)] px-2 text-center text-[0.68rem] uppercase tracking-[0.12em] text-[var(--ivory)] transition-colors hover:border-[var(--gold)] hover:text-[var(--gold)]"
              style={{ borderRadius: "3px" }}
            >
              Maps
            </a>
          </div>

          <address className="mb-4 not-italic text-[0.95rem] text-[var(--ivory-dim)]">
            {venue.address}
          </address>

          {/* A fixed first column so the day labels line up down the page. */}
          <dl className="mb-4 grid grid-cols-[4.6rem_1fr] gap-x-4 gap-y-[0.55rem] text-[0.88rem]">
            {venue.hours.map((row) => {
              const closed = row.time === "Closed";

              return (
                <div key={row.days} className="contents">
                  <dt className="text-[0.68rem] uppercase tracking-[0.12em] text-[var(--gold)]">
                    {row.days}
                  </dt>
                  <dd
                    className={closed ? "text-[var(--muted)]" : "text-[var(--ivory-dim)]"}
                  >
                    {row.time}
                  </dd>
                </div>
              );
            })}
          </dl>

          <ul className="mb-4 flex list-none flex-wrap gap-1.5 p-0">
            {venue.chips.map((chip) => (
              <li
                key={chip}
                className="border border-[rgba(229,226,225,.18)] px-2 py-1 text-[0.64rem] uppercase tracking-[0.12em] text-[var(--ivory-dim)]"
              >
                {chip}
              </li>
            ))}
          </ul>

          <p className="text-[0.85rem] text-[var(--muted)]">{venue.transport}</p>
        </div>
      </div>
    </article>
  );
}