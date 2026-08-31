import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Clock, Mail, MapPin, Phone, UtensilsCrossed } from "lucide-react";
import { Eyebrow } from "@/components/site/section";
import { SplitReveal } from "@/components/site/motion/split-reveal";
import { CONTACT_DETAILS } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Sweet1NE in Lewisham and Chingford — addresses, phone numbers and opening hours.",
};

/**
 * No enquiry form.
 *
 * Most of what people want here is a phone number or a table, and both are
 * one tap away. A general contact form would land in an inbox nobody watches
 * during service — worse than not offering one.
 */
export default function ContactPage() {
  return (
    <>
      <section className="relative border-b border-[var(--hairline-faint)] pt-32 sm:pt-40">
        <div className="glow left-1/4 top-0 h-[400px] w-[400px]" />

        <div className="relative mx-auto max-w-[1440px] px-5 pb-12 sm:px-8 sm:pb-16 lg:px-12">
          <Eyebrow>Get in touch</Eyebrow>
          <SplitReveal
            as="h1"
            className="font-display text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.95] tracking-[-0.02em]"
          >
            {"Give us a call,\nor just turn up."}
          </SplitReveal>

          <p className="mt-6 max-w-lg text-lg leading-relaxed text-[var(--ivory-dim)]">
            Booking a table is the surest way in — we're busy most nights. For
            anything else, the phone is quickest.
          </p>

          <Link
            href="/reservations"
            className="mt-8 inline-block bg-[var(--gold)] px-8 py-4 text-sm font-semibold text-[#0e0e0e] hover:bg-[var(--gold-deep)]"
            style={{ borderRadius: "4px" }}
          >
            Book a table
          </Link>
        </div>
      </section>

      {/* The branches */}
      <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-24 lg:px-12">
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
          {CONTACT_DETAILS.map((branch) => (
            <article
              key={branch.name}
              className="border border-[var(--hairline-faint)]"
              style={{ borderRadius: "4px" }}
            >
              <div className="relative aspect-[16/9] overflow-hidden">
                <Image
                  src={branch.image}
                  alt={branch.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e]/85 to-transparent" />

                <div className="absolute inset-x-0 bottom-0 p-6">
                  <p className="label-caps text-[var(--gold)]">{branch.area}</p>
                  <h2 className="mt-2 font-display text-[1.75rem] leading-tight">
                    {branch.name}
                  </h2>
                </div>
              </div>

              <div className="space-y-6 p-6">
                {/* Address */}
                <div className="flex items-start gap-3">
                  <MapPin
                    size={16}
                    strokeWidth={1}
                    className="mt-1 shrink-0 text-[var(--gold)]"
                  />
                  <div>
                    <p className="label-caps text-[var(--muted)]">Address</p>
                    <address className="mt-1.5 not-italic text-[var(--ivory)]">
                      {branch.address.map((line) => (
                        <span key={line} className="block">
                          {line}
                        </span>
                      ))}
                    </address>
                    
                    <a  href={branch.mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 border-b border-[var(--ivory)]/30 pb-0.5 text-sm transition-colors hover:border-[var(--gold)] hover:text-[var(--gold)]"
                    >
                      Directions
                      <ArrowUpRight size={13} strokeWidth={1} />
                    </a>
                  </div>
                </div>

                {/* Phone — the thing most people came for. */}
                <div className="flex items-start gap-3">
                  <Phone
                    size={16}
                    strokeWidth={1}
                    className="mt-1 shrink-0 text-[var(--gold)]"
                  />
                  <div>
                    <p className="label-caps text-[var(--muted)]">Phone</p>
                    
                    <a href={`tel:${branch.phoneHref}`}
                      className="mt-1.5 block font-display text-2xl text-[var(--ivory)] transition-colors hover:text-[var(--gold)]"
                    >
                      {branch.phone}
                    </a>
                  </div>
                </div>

                {/* Hours */}
                <div className="flex items-start gap-3">
                  <Clock
                    size={16}
                    strokeWidth={1}
                    className="mt-1 shrink-0 text-[var(--gold)]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="label-caps text-[var(--muted)]">Hours</p>
                    <dl className="mt-2 space-y-1.5">
                      {branch.hours.map((entry) => {
                        const closed = entry.time === "Closed";
                        return (
                          <div
                            key={entry.days}
                            className="flex justify-between gap-4 text-sm"
                          >
                            <dt
                              className={closed ? "text-[var(--muted)]" : "text-[var(--ivory-dim)]"}
                            >
                              {entry.days}
                            </dt>
                            <dd
                              className={
                                closed
                                  ? "shrink-0 text-[var(--muted)]"
                                  : "shrink-0 text-[var(--ivory)]"
                              }
                            >
                              {entry.time}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>

                    {/* Set apart, because arriving at 10pm for food is the
                        mistake this prevents. */}
                    <p className="mt-3 flex items-start gap-2 border-t border-[var(--hairline-faint)] pt-3 text-sm text-[var(--gold)]">
                      <UtensilsCrossed size={14} strokeWidth={1} className="mt-0.5 shrink-0" />
                      {branch.kitchenNote}
                    </p>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Everything else */}
      <section className="border-t border-[var(--hairline-faint)] bg-[#131313]">
        <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
          <div className="grid gap-10 sm:grid-cols-3">
            <div>
              <p className="label-caps text-[var(--gold)]">General enquiries</p>
              
              <a  href="mailto:info@sweet1ne.com"
                className="mt-3 inline-flex items-center gap-2 text-[var(--ivory)] transition-colors hover:text-[var(--gold)]"
              >
                <Mail size={15} strokeWidth={1} />
                info@sweet1ne.com
              </a>
            </div>

            <div>
              <p className="label-caps text-[var(--gold)]">Private hire &amp; events</p>
              <p className="mt-3 text-sm leading-relaxed text-[var(--ivory-dim)]">
                Birthdays, group bookings and whole-room hire — start with a
                reservation and tell us what you're planning.
              </p>
              <Link
                href="/reservations"
                className="mt-3 inline-block border-b border-[var(--ivory)]/30 pb-0.5 text-sm transition-colors hover:border-[var(--gold)] hover:text-[var(--gold)]"
              >
                Make an enquiry
              </Link>
            </div>

            <div>
              <p className="label-caps text-[var(--gold)]">Find us online</p>
              <div className="mt-3 flex flex-col gap-2">
                
                <a  href="https://instagram.com/sweet1necuisine"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-[var(--ivory-dim)] hover:text-[var(--gold)]"
                >
                  Instagram
                  <ArrowUpRight size={13} strokeWidth={1} />
                </a>
                
                <a  href="https://tiktok.com/@sweet1necuisine"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-[var(--ivory-dim)] hover:text-[var(--gold)]"
                >
                  TikTok
                  <ArrowUpRight size={13} strokeWidth={1} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}