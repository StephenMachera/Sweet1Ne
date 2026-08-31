import type { Metadata } from "next";
import Image from "next/image";
import { Clock, Sparkles, Users } from "lucide-react";
import { Eyebrow } from "@/components/site/section";
import { SplitReveal } from "@/components/site/motion/split-reveal";
import { MaskReveal } from "@/components/site/motion/mask-reveal";
import { Parallax } from "@/components/site/motion/parallax";
import { ReservationForm } from "@/components/site/reservation-form";

export const metadata: Metadata = {
  title: "Reservations",
  description:
    "Book a table at Sweet1NE Lewisham or Chingford, or enquire about private hire.",
};

export default function ReservationsPage() {
  return (
    <>
      {/* Atmosphere first — this is where the photography earns its place.
          The form comes once they've decided they want to be here. */}
      <section className="relative flex min-h-[85svh] items-end overflow-hidden">
        <Parallax className="absolute inset-0 h-[120%]" amount={0.1}>
          <Image
            src="/images/interiors/reservations-hero.jpg"
            alt="A full table at Sweet1NE"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        </Parallax>

        <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e] via-[#0e0e0e]/30 to-[#0e0e0e]/50" />
        <div className="glow left-[10%] top-1/3 h-[420px] w-[420px]" />

        <div className="relative mx-auto w-full max-w-[1440px] px-5 pb-20 sm:px-8 sm:pb-28 lg:px-12">
          <Eyebrow>Lewisham &amp; Chingford</Eyebrow>
          <SplitReveal
            as="h1"
            className="max-w-3xl font-display text-[clamp(2.75rem,7vw,5.5rem)] leading-[0.95] tracking-[-0.02em]"
          >
            {"Save yourself\nthe wait."}
          </SplitReveal>

          <p className="mt-8 max-w-md text-lg leading-relaxed text-[var(--ivory-dim)]">
            We're busy most nights and tables turn every two hours. Booking ahead
            is the surest way in.
          </p>
        </div>
      </section>

      {/* Three things worth knowing before they fill anything in. */}
      <section className="border-y border-[var(--hairline-faint)] bg-[#131313]">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
          <div className="grid divide-y divide-[var(--hairline-faint)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="py-8 sm:px-8 sm:py-12 sm:first:pl-0">
              <Clock size={20} strokeWidth={1} className="text-[var(--gold)]" />
              <p className="label-caps mt-4 text-[var(--ivory)]">Two hours a table</p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--ivory-dim)]">
                Demand is what it is. Plenty of time for a proper meal.
              </p>
            </div>

            <div className="py-8 sm:px-8 sm:py-12">
              <Users size={20} strokeWidth={1} className="text-[var(--gold)]" />
              <p className="label-caps mt-4 text-[var(--ivory)]">Groups welcome</p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--ivory-dim)]">
                The food is built for sharing. Bring people.
              </p>
            </div>

            <div className="py-8 sm:px-8 sm:py-12 sm:last:pr-0">
              <Sparkles size={20} strokeWidth={1} className="text-[var(--gold)]" />
              <p className="label-caps mt-4 text-[var(--ivory)]">Celebrating something?</p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--ivory-dim)]">
                Tell us and we'll make a bit of a thing of it.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Form, with imagery alongside on desktop so the page never becomes
          a bare wall of inputs. */}
      <section className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-24 lg:px-12">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr] lg:gap-16">
          <div>
            <Eyebrow>Request a table</Eyebrow>
            <h2 className="mb-10 font-display text-[clamp(1.75rem,4vw,2.5rem)] leading-tight">
              Tell us when, and we'll sort the rest.
            </h2>

            <ReservationForm />
          </div>

          {/* Sticky column of photography — the unused shots go here. */}
          <aside className="hidden lg:block">
            <div className="sticky top-32 space-y-4">
              <MaskReveal className="relative aspect-[4/5] overflow-hidden">
                <div className="absolute inset-0">
                  <Image
                    src="/images/food/reservations-1.jpg"
                    alt=""
                    fill
                    sizes="33vw"
                    className="object-cover"
                  />
                </div>
              </MaskReveal>

              <div className="grid grid-cols-2 gap-4">
                <MaskReveal className="relative aspect-square overflow-hidden" direction="left">
                  <div className="absolute inset-0">
                    <Image
                      src="/images/food/reservations-2.jpg"
                      alt=""
                      fill
                      sizes="16vw"
                      className="object-cover"
                    />
                  </div>
                </MaskReveal>

                <MaskReveal className="relative aspect-square overflow-hidden">
                  <div className="absolute inset-0">
                    <Image
                      src="/images/interiors/reservations-3.jpg"
                      alt=""
                      fill
                      sizes="16vw"
                      className="object-cover"
                    />
                  </div>
                </MaskReveal>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* Closing image — full bleed, no text competing with it. */}
      <section className="relative aspect-[4/5] w-full overflow-hidden sm:aspect-[21/9]">
        <Parallax className="absolute inset-0 h-[115%]" amount={0.08}>
          <Image
            src="/images/interiors/reservations-closing.jpg"
            alt="Sweet1NE at night"
            fill
            sizes="100vw"
            className="object-cover"
          />
        </Parallax>
        <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e] via-transparent to-[#0e0e0e]/30" />
      </section>
    </>
  );
}