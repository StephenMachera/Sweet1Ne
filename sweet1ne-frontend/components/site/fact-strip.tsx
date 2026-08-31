/**
 * Sits hard against the hero, no gap.
 *
 * The reference designs put six generic icon-and-label pairs here — "Online
 * Orders", "Spotless Kitchen" — which say nothing anyone couldn't claim.
 * These three are specific to Sweet1NE, and the middle one reframes the
 * 2-hour limit as evidence of demand rather than a restriction.
 */

const FACTS = [
  {
    lead: "100%",
    label: "Halal",
    detail: "Every dish, every location, no exceptions.",
  },
  {
    lead: "2 hours",
    label: "Per table",
    detail: "That's how quickly they turn. Book ahead.",
  },
  {
    lead: "Two",
    label: "London locations",
    detail: "Lewisham and East London.",
  },
];

export function FactStrip() {
  return (
    <section className="relative z-10 border-y border-[var(--hairline-faint)] bg-[#131313]">
      <div className="mx-auto max-w-[1440px] px-5 sm:px-6">
        <div className="grid divide-y divide-[var(--hairline-faint)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {FACTS.map((fact) => (
            <div key={fact.label} className="py-6 sm:px-8 sm:py-9 sm:first:pl-0 sm:last:pr-0">
              <p className="font-display text-[2.5rem] leading-none text-[var(--gold)] sm:text-[3rem]">
                {fact.lead}
              </p>
              <p className="label-caps mt-3 text-[var(--ivory)]">{fact.label}</p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--ivory-dim)]">
                {fact.detail}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}