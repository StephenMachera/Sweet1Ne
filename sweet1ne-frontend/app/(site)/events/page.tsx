import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, MapPin } from "lucide-react";
import { Eyebrow, Heading } from "@/components/site/section";
import { SplitReveal } from "@/components/site/motion/split-reveal";

export const metadata: Metadata = {
  title: "Events",
  description:
    "Sax & Mood brunches, themed nights and everything else worth turning up for.",
};

type Event = {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  image_url: string | null;
  starts_at: string;
  price_note: string | null;
  branch_name: string | null;
};

async function getEvents(): Promise<Event[]> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/public/events`, {
      // Revalidate every five minutes — events change rarely, and this keeps
      // the page fast without going stale.
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function EventsPage() {
  const events = await getEvents();
  const [next, ...rest] = events;

  return (
    <>
      <section className="relative border-b border-[var(--hairline-faint)] pt-32 sm:pt-40">
        <div className="glow left-1/3 top-0 h-[400px] w-[400px]" />

        <div className="relative mx-auto max-w-[1440px] px-5 pb-12 sm:px-8 sm:pb-16 lg:px-12">
          <Eyebrow>What's on</Eyebrow>
          <SplitReveal
            as="h1"
            className="font-display text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.95] tracking-[-0.02em]"
          >
            {"Nights worth\nplanning around."}
          </SplitReveal>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-24 lg:px-12">
        {events.length === 0 ? (
          <div className="border border-dashed border-[var(--hairline-faint)] px-6 py-24 text-center">
            <CalendarDays
              size={28}
              strokeWidth={0.75}
              className="mx-auto text-[var(--gold)]/40"
            />
            <p className="mt-5 font-display text-2xl">Nothing on the calendar yet</p>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-[var(--ivory-dim)]">
              We're planning the next one. Follow us on Instagram, or join the
              list and we'll tell you first.
            </p>
            
            <a  href="https://instagram.com/sweet1necuisine"
              target="_blank"
              rel="noreferrer"
              className="mt-8 inline-flex items-center gap-1.5 border-b border-[var(--ivory)]/30 pb-1 text-sm hover:border-[var(--gold)] hover:text-[var(--gold)]"
            >
              Follow on Instagram
              <ArrowUpRight size={14} strokeWidth={1} />
            </a>
          </div>
        ) : (
          <>
            {/* The next one gets the room. */}
            <FeaturedEvent event={next} />

            {rest.length > 0 && (
              <>
                <p className="label-caps mb-6 mt-20 text-[var(--gold)]">
                  Also coming up
                </p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function FeaturedEvent({ event }: { event: Event }) {
  return (
    <Link
      href={`/events/${event.slug}`}
      className="group relative block aspect-[4/5] overflow-hidden sm:aspect-[21/9]"
    >
      {event.image_url ? (
        <Image
          src={event.image_url}
          alt={event.title}
          fill
          priority
          sizes="100vw"
          className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.03]"
        />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-[#201f1f] to-[#0e0e0e]" />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e] via-[#0e0e0e]/20 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
        <p className="label-caps text-[var(--gold)]">Next up</p>

        <h2 className="mt-3 max-w-2xl font-display text-[clamp(1.75rem,4vw,3rem)] leading-tight">
          {event.title}
        </h2>

        {event.tagline && (
          <p className="mt-3 max-w-lg text-lg text-[var(--ivory-dim)]">{event.tagline}</p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[var(--ivory-dim)]">
          <span className="flex items-center gap-2">
            <CalendarDays size={15} strokeWidth={1} />
            {formatWhen(event.starts_at)}, {formatTime(event.starts_at)}
          </span>
          {event.branch_name && (
            <span className="flex items-center gap-2">
              <MapPin size={15} strokeWidth={1} />
              {event.branch_name}
            </span>
          )}
          {event.price_note && <span className="text-[var(--gold)]">{event.price_note}</span>}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 border border-transparent transition-colors duration-500 group-hover:border-[var(--hairline)]" />
    </Link>
  );
}

function EventCard({ event }: { event: Event }) {
  return (
    <Link
      href={`/events/${event.slug}`}
      className="group relative block aspect-[4/5] overflow-hidden bg-[#1c1b1b]"
    >
      {event.image_url ? (
        <Image
          src={event.image_url}
          alt={event.title}
          fill
          sizes="(max-width: 640px) 100vw, 33vw"
          className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.04]"
        />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-[#201f1f] to-[#0e0e0e]" />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e] via-[#0e0e0e]/20 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 p-5">
        <p className="label-caps text-[var(--gold)]">{formatWhen(event.starts_at)}</p>
        <h3 className="mt-2 font-display text-xl leading-tight">{event.title}</h3>
        {event.branch_name && (
          <p className="mt-1.5 text-sm text-[var(--ivory-dim)]">{event.branch_name}</p>
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 border border-transparent transition-colors duration-500 group-hover:border-[var(--hairline)]" />
    </Link>
  );
}