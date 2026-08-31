import { SplitReveal } from "./motion/split-reveal";

/**
 * Section primitives.
 *
 * The design system says 120px gaps everywhere, but a uniform rhythm reads
 * as a gallery — so spacing is a prop rather than a constant, and some
 * sections sit tighter deliberately.
 */
export function Section({
  children,
  className = "",
  spacing = "normal",
  full = false,
}: {
  children: React.ReactNode;
  className?: string;
  spacing?: "tight" | "normal" | "loose";
  full?: boolean;
}) {
  const pad = {
    tight: "py-11 sm:py-16",
    normal: "py-12 sm:py-20",
    loose: "py-16 sm:py-24",
  }[spacing];

  return (
    <section className={`relative z-10 ${pad} ${className}`}>
      <div className={full ? "" : "mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12"}>
        {children}
      </div>
    </section>
  );
}

/** Small caps line above a heading — "WHAT PEOPLE COME FOR", "FIND US". */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="label-caps mb-5 text-[var(--gold)]">{children}</p>;
}

/**
 * Section headline.
 *
 * Takes a plain string rather than JSX children so the words can be split
 * for the reveal — use \n for line breaks, and wrap the accent line in the
 * `accent` prop if part of it should be gold.
 *
 * Scales fluidly rather than in breakpoint steps, so it looks right at every
 * width, not just the ones that got tested.
 */
export function Heading({
  children,
  accent,
  className = "",
  as = "h2",
}: {
  children: string;
  /** Optional second line, rendered in gold beneath the first. */
  accent?: string;
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  const base = `font-display text-[clamp(2rem,5vw,3.5rem)] leading-[1.05] tracking-[-0.01em] ${className}`;

  if (!accent) {
    return (
      <SplitReveal as={as} className={base}>
        {children}
      </SplitReveal>
    );
  }

  return (
    <div>
      <SplitReveal as={as} className={base}>
        {children}
      </SplitReveal>
      <SplitReveal
        as="p"
        // Slightly behind the first line, so the gold arrives as a beat
        // rather than at the same moment.
        delay={0.15}
        className={`${base} text-[var(--gold)]`}
      >
        {accent}
      </SplitReveal>
    </div>
  );
}