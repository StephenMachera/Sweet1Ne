import type { Metadata } from "next";
import { LocationSections } from "@/components/site/location-sections";
import { Eyebrow } from "@/components/site/section";
import { SplitReveal } from "@/components/site/motion/split-reveal";

export const metadata: Metadata = {
  title: "Locations",
  description:
    "Sweet1NE in Lewisham and Chingford — addresses, opening hours and how to find us.",
};

export default function LocationsPage() {
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

          <p className="mt-6 max-w-lg text-lg leading-relaxed text-[var(--ivory-dim)]">
            Both closed Monday and Tuesday. Both busy the rest of the week —
            booking ahead is the surest way in.
          </p>
        </div>
      </section>

      <LocationSections />
    </>
  );
}