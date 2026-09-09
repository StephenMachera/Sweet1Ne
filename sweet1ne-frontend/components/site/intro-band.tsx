"use client";

import { SplitReveal } from "./motion/split-reveal";
import { Eyebrow } from "./section";

/**
 * A breath between the hero and the dishes.
 *
 * Short deliberately — the food is about to speak for itself, so this only
 * has to set the register and get out of the way.
 */
export function IntroBand() {
  return (
    <section className="relative border-b border-[var(--hairline-faint)] py-14 sm:py-20">
      <div className="glow left-1/3 top-0 h-[340px] w-[340px] opacity-50" />

      <div className="relative mx-auto max-w-[1440px] px-5 text-center sm:px-8 lg:px-12">
        <Eyebrow>The menu</Eyebrow>

        <SplitReveal
          as="h2"
          className="mx-auto max-w-3xl font-display text-[clamp(1.75rem,5vw,3.25rem)] leading-[1.12] tracking-[-0.02em]"
        >
          {"Scroll slowly.\nThis part is the good bit."}
        </SplitReveal>
      </div>
    </section>
  );
}