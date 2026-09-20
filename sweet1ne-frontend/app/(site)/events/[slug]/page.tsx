import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock, MapPin } from "lucide-react";
import { Heading } from "@/components/site/section";
import { BookTableButton } from "@/components/site/booking-modal";
import { heroImageOf, imagesOf, type EventBlock, type EventCta } from "@/components/events/event-blocks";

type Event = {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  description: string | null;
  image_url: string | null;
  starts_at: string;
  ends_at: string | null;
  price_note: string | null;
  branch_name: string | null;
  layout: EventBlock[];
  ctas: EventCta[];
};

async function getEvent(slug: string): Promise<Event | null> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/public/events/${slug}`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEvent(slug);

  if (!event) return { title: "Event" };

  return {
    title: event.title,
    description: event.tagline ?? undefined,
    openGraph: {
      title: event.title,
      description: event.tagline ?? undefined,
      images: event.image_url ? [event.image_url] : undefined,
    },
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getEvent(slug);

  if (!event) notFound();

  const when = new Date(event.starts_at);

  return (
    <>
      <section className="relative flex min-h-[60svh] items-end overflow-hidden pt-32">
        {event.image_url ? (
          <Image
            src={event.image_url}
            alt={event.title}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#201f1f] to-[#0e0e0e]" />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e] via-[#0e0e0e]/40 to-[#0e0e0e]/60" />

        <div className="relative mx-auto w-full max-w-[1440px] px-5 pb-12 sm:px-8 sm:pb-16 lg:px-12">
          <Link
            href="/events"
            className="mb-8 inline-flex items-center gap-2 text-sm text-[var(--ivory-dim)] hover:text-[var(--gold)]"
          >
            <ArrowLeft size={15} strokeWidth={1} />
            All events
          </Link>

          <h1 className="max-w-3xl font-display text-[clamp(2.25rem,6vw,4.5rem)] leading-[0.95] tracking-[-0.02em]">
            {event.title}
          </h1>

          {event.tagline && (
            <p className="mt-5 max-w-xl text-xl text-[var(--ivory-dim)]">{event.tagline}</p>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-24 lg:px-12">
        <div className="grid gap-12 lg:grid-cols-[1fr_2fr] lg:gap-20">
          {/* Details */}
          <div className="space-y-6 lg:sticky lg:top-32 lg:self-start">
            <div className="border-l border-[var(--hairline)] pl-5">
              <p className="label-caps text-[var(--gold)]">When</p>
              <p className="mt-2 flex items-center gap-2 text-[var(--ivory)]">
                <CalendarDays size={15} strokeWidth={1} className="shrink-0" />
                {when.toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
              <p className="mt-1.5 flex items-center gap-2 text-[var(--ivory-dim)]">
                <Clock size={15} strokeWidth={1} className="shrink-0" />
                From{" "}
                {when.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                {event.ends_at &&
                  ` until ${new Date(event.ends_at).toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`}
              </p>
            </div>

            <div className="border-l border-[var(--hairline)] pl-5">
              <p className="label-caps text-[var(--gold)]">Where</p>
              <p className="mt-2 flex items-center gap-2 text-[var(--ivory)]">
                <MapPin size={15} strokeWidth={1} className="shrink-0" />
                {event.branch_name ?? "Both locations"}
              </p>
            </div>

            {event.price_note && (
              <div className="border-l border-[var(--hairline)] pl-5">
                <p className="label-caps text-[var(--gold)]">Entry</p>
                <p className="mt-2 text-[var(--ivory)]">{event.price_note}</p>
              </div>
            )}

            <BookTableButton
              className="block w-full bg-[var(--gold)] px-6 py-4 text-center text-sm font-semibold text-[#0e0e0e] hover:bg-[var(--gold-deep)]"
              style={{ borderRadius: "4px" }}
            >
              Book a table
            </BookTableButton>

            {event.ctas
              .filter((c) => c.kind !== "book")
              .map((c, i) => (
                <a
                  key={i}
                  href={c.href}
                  className="block w-full border border-[var(--ivory)]/25 px-6 py-4 text-center text-sm text-[var(--ivory-dim)] hover:border-[var(--ivory)]/50 hover:text-[var(--ivory)]"
                  style={{ borderRadius: "4px" }}
                >
                  {c.label}
                </a>
              ))}
          </div>

          {/* Description */}
          <div>
            {event.description ? (
              <div className="space-y-5 text-lg leading-relaxed text-[var(--ivory-dim)]">
                {event.description.split("\n\n").map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            ) : (
              <p className="text-lg text-[var(--ivory-dim)]">
                More details coming soon. Book a table to be there.
              </p>
            )}

            {event.layout
              .filter((b): b is Extract<EventBlock, { type: "note" }> => b.type === "note" && Boolean(b.text))
              .map((b) => (
                <p
                  key={b.id}
                  className="mt-6 border-l border-[var(--gold)] pl-4 text-base italic text-[var(--ivory-dim)]"
                >
                  {b.text}
                </p>
              ))}

            {(() => {
              const hero = heroImageOf(event.layout);
              const extras = imagesOf(event.layout).filter((b) => b !== hero);
              if (!extras.length) return null;
              return (
                <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {extras.map((b) => (
                    <img
                      key={b.id}
                      src={b.image_url}
                      alt=""
                      className="aspect-[4/3] w-full object-cover"
                      style={{ borderRadius: "4px" }}
                    />
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </>
  );
}