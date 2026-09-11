import Image from "next/image";
import Link from "next/link";
import { RESERVATION_URLS } from "@/lib/site-content";

// Narrowed so a venue can only ever point at a booking URL that exists.
type Venue = {
  slug: keyof typeof RESERVATION_URLS;
  name: string;
  area: string;
  address: string;
  hours: string;
  phone: string;
  phoneHref: string;
  perks: string[];
  mapsUrl: string;
  image: string;
};

const VENUES: Venue[] = [
  {
    slug: "lewisham",
    name: "Lewisham",
    area: "South East London",
    address: "2 Loampit Hill, London SE13 7SW",
    hours: "Wed–Sun, from midday",
    phone: "020 3340 6750",
    phoneHref: "+442033406750",
    perks: ["Kids' menu", "Private hire"],
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Sweet1NE+2+Loampit+Hill+London+SE13+7SW",
    image: "/images/homepage-gallery/story/hero-lewisham-a.jpg",
  },
  {
    slug: "chingford",
    name: "Chingford",
    area: "East London",
    address: "164 Station Road, Chingford, London E4 6AN",
    hours: "Wed–Sun, from midday",
    phone: "020 3971 3449",
    phoneHref: "+442039713449",
    perks: ["Shisha", "Kids' menu", "Private hire"],
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Sweet1NE+164+Station+Road+Chingford+London+E4+6AN",
    image: "/images/homepage-gallery/story/hero-chingford-2.jpg",
  },
];

/**
 * Both restaurants, side by side.
 *
 * Deliberately plain after the emblems and the washed band above — someone
 * reaching this point wants an address and a phone number, not another
 * effect.
 */
export function Restaurants() {
  return (
    <section
      id="restaurants"
      className="mx-auto max-w-[1180px] px-5 pb-20 pt-5 sm:px-6"
    >
      <p className="text-center text-[0.72rem] uppercase tracking-[0.2em] text-[var(--gold)]">
        Find us
      </p>

      <h2 className="mt-3 text-center font-display text-[clamp(2.1rem,4.5vw,3.2rem)] font-medium leading-tight">
        Choose a restaurant.
      </h2>

      <p className="mx-auto mb-9 mt-3.5 max-w-[32rem] text-center text-[var(--ivory-dim)]">
        Same kitchen, same menu, same night out — one in the south, one in the
        east.
      </p>

      <div className="grid gap-[1.1rem] md:grid-cols-2">
        {VENUES.map((venue) => (
          <VenueCard key={venue.slug} venue={venue} />
        ))}
      </div>
    </section>
  );
}

function VenueCard({ venue }: { venue: Venue }) {
  return (
    <article className="bg-[#141414]">
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <Image
          src={venue.image}
          alt={`Sweet1NE ${venue.name}`}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover"
        />
      </div>

      <div className="px-[1.35rem] pb-[1.55rem] pt-[1.35rem]">
        <p className="mb-1.5 text-[0.68rem] uppercase tracking-[0.16em] text-[var(--gold)]">
          {venue.area}
        </p>

        <h3 className="mb-1.5 font-display text-[1.85rem] font-medium leading-tight">
          {venue.name}
        </h3>

        <p className="mb-1 text-[0.9rem] text-[var(--ivory-dim)]">{venue.address}</p>
        <p className="mb-1 text-[0.9rem] text-[var(--ivory-dim)]">{venue.hours}</p>

        <p className="text-[0.9rem]">
          
          <a  href={`tel:${venue.phoneHref}`}
            className="text-[var(--gold)] transition-opacity hover:opacity-80"
          >
            {venue.phone}
          </a>
        </p>

        <ul className="mt-3.5 flex list-none flex-wrap gap-1.5 p-0">
          {venue.perks.map((perk) => (
            <li
              key={perk}
              className="border border-[rgba(229,226,225,.18)] px-2 py-1 text-[0.64rem] uppercase tracking-[0.12em] text-[var(--ivory-dim)]"
            >
              {perk}
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
          {/* The card already says which branch, so this skips the modal
              and goes straight to that branch's SevenRooms page. */}
          <a
            href={RESERVATION_URLS[venue.slug]}
            target="_blank"
            rel="noreferrer"
            className="inline-block bg-[var(--gold)] px-[1.2rem] py-[0.7rem] text-[0.82rem] font-semibold text-[#0e0e0e] transition-opacity hover:opacity-90"
            style={{ borderRadius: "4px" }}
          >
            Book {venue.name}
          </a>

          
          <a  href={venue.mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center gap-1.5 text-[0.85rem] text-[var(--ivory)] transition-colors hover:text-[var(--gold)]"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden
              className="h-[1.05rem] w-[1.05rem] shrink-0 fill-none stroke-[var(--gold)]"
            >
              <path
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11z"
              />
              <circle cx="12" cy="10" r="2.2" strokeWidth="1.6" />
            </svg>
            Open in maps
          </a>
        </div>
      </div>
    </article>
  );
}