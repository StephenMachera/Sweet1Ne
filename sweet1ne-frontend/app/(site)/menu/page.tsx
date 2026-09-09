import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Eyebrow } from "@/components/site/section";
import { SplitReveal } from "@/components/site/motion/split-reveal";
import { Parallax } from "@/components/site/motion/parallax";
import { MenuSections } from "@/components/site/menu-sections";
import { MENU_INTRO } from "@/lib/menu-content";

export const metadata: Metadata = {
  title: "Menu",
  description:
    "Afro-Caribbean and American soul dishes, freshly made seafood, and handcrafted desserts. Every dish 100% Halal.",
};

export default function MenuPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative flex min-h-[70svh] items-end overflow-hidden pt-32">
        <Parallax className="absolute inset-0 h-[120%]" amount={0.08}>
          <Image
            src="/images/menu/hero.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        </Parallax>

        <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e] via-[#0e0e0e]/40 to-[#0e0e0e]/60" />
        <div className="glow left-[12%] top-1/3 h-[420px] w-[420px]" />

        <div className="relative mx-auto w-full max-w-[1440px] px-5 pb-14 sm:px-8 sm:pb-20 lg:px-12">
          <Eyebrow>À la carte · 100% Halal</Eyebrow>
          <SplitReveal
            as="h1"
            className="max-w-3xl font-display text-[clamp(2.5rem,7vw,5rem)] leading-[0.95] tracking-[-0.02em]"
          >
            {"Every ingredient\ntells a story."}
          </SplitReveal>
        </div>
      </section>

      {/* The welcome, set as an introduction rather than buried */}
      <section className="border-b border-[var(--hairline-faint)]">
        <div className="mx-auto max-w-[1440px] px-5 py-14 sm:px-8 sm:py-20 lg:px-12">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
            <h2 className="font-display text-[clamp(2rem,5vw,3rem)] leading-none tracking-[-0.02em]">
              {MENU_INTRO.heading}
            </h2>

            <div className="space-y-5 text-[17px] leading-relaxed text-[var(--ivory-dim)]">
              {MENU_INTRO.paragraphs.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </div>

          {/* Allergens sit here rather than in small print at the bottom —
              it's a legal matter and someone with an allergy shouldn't have
              to hunt for it. */}
          <div className="mt-12 flex gap-4 border border-[var(--hairline)] p-5 sm:p-6">
            <AlertCircle
              size={18}
              strokeWidth={1}
              className="mt-0.5 shrink-0 text-[var(--gold)]"
            />
            <p className="text-[15px] leading-relaxed text-[var(--ivory-dim)]">
              {MENU_INTRO.allergens}
            </p>
          </div>
        </div>
      </section>

      <MenuSections />

      {/* Close */}
      <section className="border-t border-[var(--hairline-faint)] bg-[#131313]">
        <div className="mx-auto max-w-[1440px] px-5 py-16 text-center sm:px-8 sm:py-24 lg:px-12">
          <h2 className="font-display text-[clamp(1.75rem,4.5vw,3rem)] leading-tight">
            Hungry yet?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[var(--ivory-dim)]">
            We're busy most nights. Booking ahead is the surest way in.
          </p>

          <div className="mt-9 flex flex-wrap justify-center gap-4">
            <Link
              href="/reservations"
              className="bg-[var(--gold)] px-8 py-4 text-sm font-semibold text-[#0e0e0e] hover:bg-[var(--gold-deep)]"
              style={{ borderRadius: "4px" }}
            >
              Book a table
            </Link>
            <Link
              href="/order"
              className="border border-[var(--ivory)]/40 px-8 py-4 text-sm font-semibold hover:border-[var(--gold)] hover:text-[var(--gold)]"
              style={{ borderRadius: "4px" }}
            >
              Order for collection
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}