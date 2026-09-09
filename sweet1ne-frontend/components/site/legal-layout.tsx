import Link from "next/link";
import { Eyebrow } from "./section";

/**
 * Shared chrome for the privacy notice and terms.
 *
 * Deliberately plain — legal pages should be easy to read and easy to
 * search, not atmospheric. Light-on-dark still, but with generous line
 * height and a narrow measure.
 */
export function LegalPage({
  eyebrow,
  title,
  version,
  effective,
  children,
}: {
  eyebrow: string;
  title: string;
  version: string;
  effective: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <section className="relative border-b border-[var(--hairline-faint)] pt-32 sm:pt-40">
        <div className="glow left-1/4 top-0 h-[360px] w-[360px] opacity-50" />

        <div className="relative mx-auto max-w-3xl px-5 pb-10 sm:px-8">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="font-display text-[clamp(2rem,5vw,3.25rem)] leading-[1.05] tracking-[-0.02em]">
            {title}
          </h1>

          <p className="mt-5 text-sm text-[var(--muted)]">
            Version {version} · Effective {effective}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
        {children}

        <div className="mt-16 border-t border-[var(--hairline-faint)] pt-8">
          <p className="text-sm text-[var(--ivory-dim)]">
            Questions about any of this?{" "}
            
            <a  href="mailto:info@sweet1ne.com"
              className="border-b border-[var(--ivory)]/30 hover:border-[var(--gold)] hover:text-[var(--gold)]"
            >
              info@sweet1ne.com
            </a>
          </p>

          <Link
            href="/"
            className="mt-6 inline-block border-b border-[var(--ivory)]/30 pb-1 text-sm transition-colors hover:border-[var(--gold)] hover:text-[var(--gold)]"
          >
            Back to Sweet1NE
          </Link>
        </div>
      </div>
    </>
  );
}

export function Section({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={`section-${number}`} className="scroll-mt-24 border-t border-[var(--hairline-faint)] py-8 first:border-0 first:pt-0">
      <h2 className="font-display text-xl leading-tight text-[var(--ivory)] sm:text-2xl">
        <span className="mr-3 text-[var(--gold)]">{number}.</span>
        {title}
      </h2>

      <div className="mt-4 space-y-4 text-[15px] leading-[1.75] text-[var(--ivory-dim)]">
        {children}
      </div>
    </section>
  );
}

export function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--gold)]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Two-column table for lawful bases, recipients and retention. */
export function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--hairline)]">
            {headers.map((header) => (
              <th
                key={header}
                className="label-caps py-3 pr-6 text-left text-[var(--gold)] last:pr-0"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-[var(--hairline-faint)] last:border-0">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="py-3.5 pr-6 align-top leading-relaxed text-[var(--ivory-dim)] last:pr-0"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}