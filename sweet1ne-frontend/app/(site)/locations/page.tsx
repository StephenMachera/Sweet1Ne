import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Clock, MapPin, Phone, Train, Users } from "lucide-react";
import { Eyebrow } from "@/components/site/section";
import { SplitReveal } from "@/components/site/motion/split-reveal";
import { MaskReveal } from "@/components/site/motion/mask-reveal";
import { LOCATION_DETAILS } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Locations",
  description: "Sweet1NE in Lewisham and Chingford — addresses, hours and how to find us.",
};

type Location = {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  phone: string | null;
  capacity: number | null;
  image_url: string | null;
  opening_time: string | null;
  closing_time: string | null;
};

async function getLocations(): Promise<Location[]> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/public/site/locations`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

/** "12:00" and "23:00" become "Midday until 11pm" — reads better than a range. */
function formatHours(open: string | null, close: string | null) {
  if (!open || !close) return null;

  const pretty = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    if (h === 12 && m === 0) return "midday";
    if (h === 0 && m === 0) return "midnight";
    const hour = h % 12 || 12;
    const suffix = h < 12 ? "am" : "pm";
    return m === 0 ? `${hour}${suffix}` : `${hour}.${String(m).padStart(2, "0")}${suffix}`;
  };

  return `${pretty(open)} until ${pretty(close)}`;
}

export default async function LocationsPage() {
  const locations = await getLocations();

  return (
    <>
      <section className="relative border-b border-[var(--hairline-faint)] pt-32 sm:pt-40">
        <div className="glow left-1/4 top-0 h-[400px] w-[400px]" />

        <div className="relative mx-auto max-w-[1440px] px-5 pb-12 sm:px-8 sm:pb-16 lg:px-12">
          <Eyebrow>Two rooms in London</Eyebrow>
          <SplitReveal
            as="h1"
            className="font-display text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.95] tracking-[-0.02em]"
          >
            {"Come and\nfind us."}
          </SplitReveal>
        </div>
      </section>

      {locations.length === 0 ? (
        <p className="py-32 text-center text-sm text-[var(--muted)]">
          Location details are on their way.
        </p>
      ) : (
        locations.map((location, i) => (
          <LocationSection key={location.id} location={location} flipped={i % 2 === 1} />
        ))
      )}
    </>
  );
}

function LocationSection({
  location,
  flipped,
}: {
  location: Location;
  flipped: boolean;
}) {
  const details = LOCATION_DETAILS[location.slug];
  const hours = formatHours(location.opening_time, location.closing_time);

  // Prefer the branch's own photography, falling back to the static set.
  const images = details?.images ?? [];
  const hero = location.image_url ?? images[0];

  return (
    <section
      id={location.slug}
      className="border-b border-[var(--hairline-faint)] last:border-0"
    >
      <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-24 lg:px-12">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Photography */}
          <div className={flipped ? "lg:order-2" : ""}>
            {hero && (
              <MaskReveal
                className="relative aspect-[4/3] overflow-hidden"
                direction={flipped ? "left" : "up"}
              >
                <div className="absolute inset-0">
                  <Image
                    src={hero}
                    alt={location.name}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                  />
                </div>
              </MaskReveal>
            )}

            {images.length > 1 && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                {images.slice(1, 3).map((src) => (
                  <div key={src} className="relative aspect-[4/3] overflow-hidden">
                    <Image
                      src={src}
                      alt=""
                      fill
                      sizes="(max-width: 1024px) 50vw, 25vw"
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className={flipped ? "lg:order-1" : ""}>
            {details && <p className="label-caps text-[var(--gold)]">{details.area}</p>}

            <h2 className="mt-4 font-display text-[clamp(2rem,4.5vw,3rem)] leading-tight">
              {location.name}
            </h2>

            {details && (
              <p className="mt-5 text-lg leading-relaxed text-[var(--ivory-dim)]">
                {details.blurb}
              </p>
            )}

            {/* Practical detail — the reason most people opened this page. */}
            <dl className="mt-8 space-y-5">
              {location.address && (
                <div className="flex items-start gap-3">
                  <MapPin
                    size={16}
                    strokeWidth={1}
                    className="mt-1 shrink-0 text-[var(--gold)]"
                  />
                  <div>
                    <dt className="label-caps text-[var(--muted)]">Address</dt>
                    <dd className="mt-1 text-[var(--ivory)]">{location.address}</dd>
                  </div>
                </div>
              )}

              {hours && (
                <div className="flex items-start gap-3">
                  <Clock
                    size={16}
                    strokeWidth={1}
                    className="mt-1 shrink-0 text-[var(--gold)]"
                  />
                  <div>
                    <dt className="label-caps text-[var(--muted)]">Open</dt>
                    <dd className="mt-1 text-[var(--ivory)]">{hours}</dd>
                  </div>
                </div>
              )}

              {location.phone && (
                <div className="flex items-start gap-3">
                  <Phone
                    size={16}
                    strokeWidth={1}
                    className="mt-1 shrink-0 text-[var(--gold)]"
                  />
                  <div>
                    <dt className="label-caps text-[var(--muted)]">Phone</dt>
                    <dd className="mt-1">
                      
                      <a  href={`tel:${location.phone.replace(/\s/g, "")}`}
                        className="text-[var(--ivory)] hover:text-[var(--gold)]"
                      >
                        {location.phone}
                      </a>
                    </dd>
                  </div>
                </div>
              )}

              {details?.transport && details.transport.length > 0 && (
                <div className="flex items-start gap-3">
                  <Train
                    size={16}
                    strokeWidth={1}
                    className="mt-1 shrink-0 text-[var(--gold)]"
                  />
                  <div>
                    <dt className="label-caps text-[var(--muted)]">Getting here</dt>
                    <dd className="mt-1 space-y-0.5 text-[var(--ivory)]">
                      {details.transport.map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                    </dd>
                  </div>
                </div>
              )}

              {location.capacity && (
                <div className="flex items-start gap-3">
                  <Users
                    size={16}
                    strokeWidth={1}
                    className="mt-1 shrink-0 text-[var(--gold)]"
                  />
                  <div>
                    <dt className="label-caps text-[var(--muted)]">Covers</dt>
                    <dd className="mt-1 text-[var(--ivory)]">Seats {location.capacity}</dd>
                  </div>
                </div>
              )}
            </dl>

            {details?.perks && details.perks.length > 0 && (
              <div className="mt-8 flex flex-wrap gap-2">
                {details.perks.map((perk) => (
                  <span
                    key={perk}
                    className="label-caps border border-[var(--hairline-faint)] px-3 py-1.5 text-[var(--ivory-dim)]"
                    style={{ borderRadius: "4px" }}
                  >
                    {perk}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/reservations"
                className="bg-[var(--gold)] px-7 py-4 text-sm font-semibold text-[#0e0e0e] hover:bg-[var(--gold-deep)]"
                style={{ borderRadius: "4px" }}
              >
                Book this branch
              </Link>

              {details?.mapsUrl && (
                
                <a href={details.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 border border-[var(--ivory)]/40 px-7 py-4 text-sm font-semibold hover:border-[var(--gold)] hover:text-[var(--gold)]"
                  style={{ borderRadius: "4px" }}
                >
                  Directions
                  <ArrowUpRight size={15} strokeWidth={1.5} />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}