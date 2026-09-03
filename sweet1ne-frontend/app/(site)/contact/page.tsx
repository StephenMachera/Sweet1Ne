import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Clock, Mail, MapPin, Phone } from "lucide-react";
import { Eyebrow } from "@/components/site/section";
import { SplitReveal } from "@/components/site/motion/split-reveal";
import { EnquiryForm } from "@/components/site/enquiry-form";
import { LOCATIONS } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Sweet1NE in Lewisham and Chingford — phone numbers, opening hours, and how to reach us.",
};

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
            {"Ring us, write,\nor just turn up."}
          </SplitReveal>

          <p className="mt-6 max-w-lg text-lg leading-relaxed text-[var(--ivory-dim)]">
            The phone is quickest during opening hours. For anything that isn't
            urgent, the form below reaches the same people.
          </p>
        </div>
      </section>

      {/* The two branches — phone numbers first, since that's what most
          people came for. */}
      <div className="mx-auto max-w-[1440px] px-5 py-14 sm:px-8 sm:py-20 lg:px-12">
        <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
          {LOCATIONS.map((branch) => (
            <article
              key={branch.slug}
              className="border border-[var(--hairline-faint)]"
              style={{ borderRadius: "4px" }}
            >
              <div className="relative aspect-[16/9] overflow-hidden">
                <Image
                  src={branch.images[0]}
                  alt={branch.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e] to-transparent" />

                <div className="absolute inset-x-0 bottom-0 p-6">
                  <p className="label-caps text-[var(--gold)]">{branch.area}</p>
                  <h2 className="mt-2 font-display text-[1.75rem] leading-tight">
                    {branch.shortName}
                  </h2>
                </div>
              </div>

              <div className="space-y-6 p-6">
                {/* The phone number, set large — the most-used thing on any
                    restaurant contact page, and a proper tap target. */}
                <div className="flex items-start gap-3">
                  <Phone size={16} strokeWidth={1} className="mt-2 shrink-0 text-[var(--gold)]" />
                  <div>
                    <p className="label-caps text-[var(--muted)]">Phone</p>
                    
                    <a  href={`tel:${branch.phoneHref}`}
                      className="mt-1 block font-display text-2xl text-[var(--ivory)] transition-colors hover:text-[var(--gold)]"
                    >
                      {branch.phone}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin size={16} strokeWidth={1} className="mt-1 shrink-0 text-[var(--gold)]" />
                  <div>
                    <p className="label-caps text-[var(--muted)]">Address</p>
                    <address className="mt-1.5 not-italic text-[var(--ivory)]">
                      {branch.addressLines.map((line) => (
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

                <div className="flex items-start gap-3">
                  <Clock size={16} strokeWidth={1} className="mt-1 shrink-0 text-[var(--gold)]" />
                  <div className="min-w-0 flex-1">
                    <p className="label-caps text-[var(--muted)]">Hours</p>
                    <dl className="mt-2 space-y-2">
                      {branch.hours.map((entry) => {
                        const closed = entry.time === "Closed";
                        return (
                          <div key={entry.days} className="flex justify-between gap-4 text-sm">
                            <dt
                              className={closed ? "text-[var(--muted)]" : "text-[var(--ivory-dim)]"}
                            >
                              {entry.days}
                            </dt>
                            <dd className="shrink-0 text-right">
                              <span
                                className={closed ? "text-[var(--muted)]" : "text-[var(--ivory)]"}
                              >
                                {entry.time}
                              </span>
                              {entry.kitchen && (
                                <span className="mt-0.5 block text-xs text-[var(--gold)]">
                                  {entry.kitchen}
                                </span>
                              )}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* The form */}
      <section className="border-t border-[var(--hairline-faint)] bg-[#131313]">
        <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-24 lg:px-12">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
            <div>
              <Eyebrow>Send a message</Eyebrow>
              <h2 className="font-display text-[clamp(1.75rem,4vw,2.75rem)] leading-tight">
                Anything else,
                <br />
                <span className="text-[var(--gold)]">ask away.</span>
              </h2>

              <p className="mt-6 max-w-sm leading-relaxed text-[var(--ivory-dim)]">
                Private hire, press, working with us, or just a question about
                the menu. It reaches the same people who handle the bookings, so
                it won't sit unread.
              </p>

              <div className="mt-8 space-y-3 border-t border-[var(--hairline-faint)] pt-6">
                
                <a  href="mailto:info@sweet1ne.com"
                  className="flex items-center gap-2.5 text-[var(--ivory-dim)] transition-colors hover:text-[var(--gold)]"
                >
                  <Mail size={15} strokeWidth={1} />
                  info@sweet1ne.com
                </a>

                <div className="flex flex-wrap gap-5 pt-2">
                  
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

            <EnquiryForm />
          </div>
        </div>
      </section>
    </>
  );
}