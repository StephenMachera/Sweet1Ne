import Link from "next/link";
import { SOCIALS, LEGAL } from "@/components/site/site-footer"; // adjust the path
import { NewsletterForm } from "@/components/site/newsletter-form"; // adjust the path

export function ThankYouFooter() {
  return (
    <footer className="flex flex-col items-center border-t border-[rgba(103, 114, 96, 0.72)] px-[1.15rem] pb-10 pt-12 text-center sm:px-6 sm:pt-14">
      <h2
        className="mb-8 text-[clamp(1.6rem,4.5vw,3.75rem)] leading-[1.1]"
        style={{
          fontFamily: "var(--font-display, 'Bodoni Moda'), Georgia, serif",
          fontWeight: 400,
          color: "var(--ivory, #e5e2e1)",
        }}
      >
        Always in the mood{" "}
        <span className="italic" style={{ color: "var(--gold)" }}>
          for you.
        </span>
      </h2>

      <div className="mb-8 w-full max-w-[34rem]">
        <NewsletterForm />
      </div>

      <div className="mb-6 flex justify-center gap-2.5">
        {SOCIALS.map(({ href, label, Icon }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noreferrer"
            aria-label={label}
            className="grid h-9 w-9 place-items-center border border-[rgba(201,162,74,.35)] text-[var(--gold)] transition-colors hover:border-[var(--gold)] hover:bg-[var(--gold)] hover:text-[#0e0e0e]"
            style={{ borderRadius: "3px" }}
          >
            <Icon size={15} />
          </a>
        ))}
      </div>

      <p className="text-[0.78rem] text-[var(--ivory-dim)]">
        © 2026 Sweet1NE Cuisine. All rights reserved.
      </p>

      <div className="mx-auto mt-4 inline-flex flex-wrap justify-center gap-x-7 gap-y-2 border-b border-[rgba(229,226,225,.12)] pb-4">
        {LEGAL.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-[0.68rem] uppercase tracking-[0.14em] text-[var(--ivory-dim)] transition-colors hover:text-[var(--gold)]"
          >
            {item.label}
          </Link>
        ))}
      </div>

      <p className="mt-5 text-[0.4rem] uppercase tracking-[0.16em] text-[rgba(229,226,225,0.18)]">
        This website is Powered By
      </p>
      <p className="mt-1 text-[0.4rem] uppercase tracking-[0.16em] text-[rgba(229,226,225,0.18)]">
        Global Solutions x Spectre Limited
      </p>
    </footer>
  );
}