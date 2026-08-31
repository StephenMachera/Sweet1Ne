import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Clock, MapPin, Phone } from "lucide-react";
import { Eyebrow, Heading, Section } from "./section";
import { LOCATION_DETAILS } from "@/lib/site-content";

/** The live shape from /public/site/locations. */
export type Location = {
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

/**
 * Both branches side by side — the second-most-common reason someone opens
 * a restaurant site, after the menu.
 *
 * Live data comes from the API; the character and perks are merged in from
 * LOCATION_DETAILS by slug.
 */
export function LocationsPreview({ locations }: { locations: Location[] }) {
  if (locations.length === 0) return null;

  return (
    <Section>
      <div className="mb-10 sm:mb-16">
        <Eyebrow>Find us</Eyebrow>
        <Heading accent="same energy.">Two rooms,</Heading>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        {locations.map((location) => {
          const details = LOCATION_DETAILS[location.slug];
          const hours = formatHours(location.opening_time, location.closing_time);
          const image = location.image_url ?? details?.images[0];

          return (
            <article
              key={location.id}
              className="group border border-[var(--hairline-faint)] transition-colors duration-500 hover:border-[var(--hairline)]"
              style={{ borderRadius: "4px" }}
            >
              <Link href={`/locations#${location.slug}`} className="block">
                <div className="relative aspect-[16/10] overflow-hidden">
                  {image ? (
                    <Image
                      src={image}
                      alt={location.name}
                      fill
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-[#201f1f] to-[#0e0e0e]" />
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e]/85 to-transparent" />

                  <div className="absolute inset-x-0 bottom-0 p-6">
                    {details && (
                      <p className="label-caps text-[var(--gold)]">{details.area}</p>
                    )}
                    <h3 className="mt-2 font-display text-[1.75rem] leading-tight">
                      {location.name}
                    </h3>
                  </div>
                </div>
              </Link>

              <div className="space-y-4 p-6">
                {location.address && (
                  <div className="flex items-start gap-3 text-sm text-[var(--ivory-dim)]">
                    <MapPin size={16} strokeWidth={1} className="mt-0.5 shrink-0" />
                    <span>{location.address}</span>
                  </div>
                )}

                {hours && (
                  <div className="flex items-start gap-3 text-sm text-[var(--ivory-dim)]">
                    <Clock size={16} strokeWidth={1} className="mt-0.5 shrink-0" />
                    <span>{hours}</span>
                  </div>
                )}

                {location.phone && (
                  <div className="flex items-start gap-3 text-sm text-[var(--ivory-dim)]">
                    <Phone size={16} strokeWidth={1} className="mt-0.5 shrink-0" />
                    
                    <a  href={`tel:${location.phone.replace(/\s/g, "")}`}
                      className="hover:text-[var(--gold)]"
                    >
                      {location.phone}
                    </a>
                  </div>
                )}

                {details?.perks && details.perks.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {details.perks.slice(0, 3).map((perk) => (
                      <span
                        key={perk}
                        className="label-caps border border-[var(--hairline-faint)] px-2.5 py-1 text-[var(--ivory-dim)]"
                        style={{ borderRadius: "4px" }}
                      >
                        {perk}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-x-5 gap-y-2 pt-3">
                  {details?.mapsUrl && (
                    
                    <a  href={details.mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 border-b border-[var(--ivory)]/30 pb-1 text-sm transition-colors hover:border-[var(--gold)] hover:text-[var(--gold)]"
                    >
                      Directions
                      <ArrowUpRight size={14} strokeWidth={1} />
                    </a>
                  )}
                  <Link
                    href={`/locations#${location.slug}`}
                    className="border-b border-transparent pb-1 text-sm text-[var(--ivory-dim)] transition-colors hover:border-[var(--gold)] hover:text-[var(--gold)]"
                  >
                    More about this site
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </Section>
  );
}