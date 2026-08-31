import type { Metadata } from "next";
import Link from "next/link";
import { Eyebrow, Heading } from "@/components/site/section";
import { MenuGrid } from "@/components/site/menu-grid";

export const metadata: Metadata = {
  title: "Menu",
  description:
    "Seafood boils, sharing platters and soul food twists — every dish 100% Halal.",
};

export default function MenuPage() {
  return (
    <>
      {/* Small hero — the grid is the point, so this just sets the scene. */}
      <section className="relative border-b border-[var(--hairline-faint)] pt-24 sm:pt-32">
        <div className="glow left-1/4 top-0 h-[400px] w-[400px]" />

        <div className="relative mx-auto max-w-[1440px] px-5 pb-10 sm:px-8 sm:pb-12 lg:px-12">
          <Eyebrow>Every dish, 100% Halal</Eyebrow>
          <Heading as="h1" accent="worth turning up for.">
            The whole
          </Heading>

          <p className="mt-6 max-w-lg text-lg leading-relaxed text-[var(--ivory-dim)]">
            Prices and availability come straight from the kitchen, so what you
            see here is what's on today.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] px-5 pb-16 sm:px-8 lg:px-12">
        <MenuGrid />
      </div>

      {/* Ordering lives on its own page — this is the handoff. */}
      <section className="border-t border-[var(--hairline-faint)] bg-[#131313]">
        <div className="mx-auto max-w-[1440px] px-5 py-12 text-center sm:px-8 sm:py-16 lg:px-12">
          <Heading accent="or take it away.">Eat in</Heading>
          <p className="mx-auto mt-5 max-w-md text-[var(--ivory-dim)]">
            Book a table, or order for collection.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
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