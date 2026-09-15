"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { QrScanner, scannerSupported } from "./qr-scanner";
import { NewsletterForm } from "./newsletter-form";
import { SiteFooter } from "./site-footer";
import { COLLECTION_URLS, LOCATIONS } from "@/lib/site-content";

type Path = "here" | "away";
type Stage = "choosing" | "scan-prompt" | "scanning";

const PATHS = [
  {
    id: "here" as const,
    image: "/images/homepage-gallery/order/emblem-here.jpg",
    heading: "I'm here now.",
    body: "You're at the table. Order from the kitchen.",
  },
  {
    id: "away" as const,
    image: "/images/homepage-gallery/order/emblem-aways.jpg",
    heading: "Taking it away.",
    body: "Order for collection and pick it up when it's ready.",
  },
];

/**
 * The fork: at the table, or taking it away.
 *
 * Choosing a path reveals the branch picker rather than navigating — so the
 * page answers both questions before handing off to the flow that needs
 * them. Dine-in ignores the branch (the QR code carries it), but asking is
 * simpler than explaining why it doesn't.
 */
export function OrderChoice() {
  const router = useRouter();
  const picksRef = useRef<HTMLElement>(null);

  const [lead, setLead] = useState<Path | null>("here");
  const [chosen, setChosen] = useState<Path | null>(null);
  const [stage, setStage] = useState<Stage>("choosing");
  const [canScan] = useState(scannerSupported);

  function choosePath(path: Path) {
    setLead(path);
    setChosen(path);

    // Bring the branch row into view — it was hidden a moment ago, so
    // without this the page looks unchanged on a short screen.
    requestAnimationFrame(() => {
      picksRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "nearest",
      });
    });
  }

  // Dine-in only — the takeaway buttons are plain links out to Toast. The
  // branch isn't needed here either: the QR code carries it.
  function chooseBranch() {
    // Scan if the browser can, otherwise tell them to use their own camera.
    setStage(canScan ? "scanning" : "scan-prompt");
  }

  function handleScan(value: string) {
    setStage("choosing");

    // The code encodes a full URL. Take the path from it rather than
    // trusting the host, so a code from elsewhere can't redirect someone
    // off-site.
    try {
      const url = new URL(value);
      router.push(`${url.pathname}${url.search}`);
    } catch {
      router.push(`/order?table=${encodeURIComponent(value)}`);
    }
  }

  if (stage === "scanning") {
    return <QrScanner onDetected={handleScan} onClose={() => setStage("choosing")} />;
  }

  if (stage === "scan-prompt") {
    return <ScanPrompt onBack={() => setStage("choosing")} />;
  }

  return (
    <div className="order-page">
      <section className="hero-copy mx-auto max-w-[54rem] px-[1.15rem] pb-[0.4rem] pt-[5.6rem] text-center sm:px-8 sm:pt-[6.2rem]">
        <p className="mb-3 text-[0.72rem] uppercase tracking-[0.2em] text-[var(--gold)]">
          Order
        </p>

        <h1 className="mb-3.5 font-display text-[clamp(2.2rem,6vw,3.6rem)] font-medium leading-[1.05] tracking-[-0.02em] [text-shadow:none] max-[720px]:text-[clamp(1.85rem,9vw,2.35rem)]">
          Where are you eating.
        </h1>

        <p className="dek mx-auto max-w-[22rem] text-[var(--ivory-dim)]">
          At the table, or taking it away.
          <br />
          Lewisham or Chingford.
        </p>
      </section>

      {/* The two paths. Offset slightly on desktop so they sit off-axis
          rather than level — the detail that stops them reading as buttons. */}
      <div aria-label="How you're ordering" className="paths mx-auto flex max-w-[54rem] items-end justify-center gap-x-[1.1rem] gap-y-[0.4rem] px-[1.15rem] pb-[0.6rem] pt-[1.4rem] max-[720px]:flex-col max-[720px]:items-center max-[720px]:gap-y-[1.8rem] max-[720px]:pt-[1.2rem] sm:gap-x-[2.2rem] sm:px-8 sm:pb-[0.8rem] sm:pt-8">
        {PATHS.map((path, i) => {
          const isLead = lead === path.id;

          return (
            <button
              key={path.id}
              type="button"
              onMouseEnter={() => {
                if (window.matchMedia("(hover: hover)").matches) setLead(path.id);
              }}
              onClick={() => choosePath(path.id)}
              className={`emblem group min-w-0 max-w-[22rem] flex-[1_1_42%] cursor-pointer border-0 bg-transparent p-0 text-center text-inherit transition-[flex,transform,opacity] duration-[850ms] ease-[cubic-bezier(0.4,0,0.2,1)] md:max-w-none ${isLead ? "flex-[1.2_1_52%] opacity-100 md:translate-y-0 md:scale-[1.02]" : "flex-[0.82_1_38%] opacity-70 hover:opacity-100"} ${!isLead && lead !== null ? (i === 0 ? "md:translate-y-[0.7rem]" : "md:-translate-y-[0.35rem]") : ""} max-[720px]:w-full max-[720px]:max-w-none max-[720px]:flex-none max-[720px]:translate-y-0 max-[720px]:opacity-100`}
            >
              <span
                className={`disc relative mx-auto mb-4 block aspect-square w-full max-w-[22rem] overflow-hidden rounded-full bg-[#111] transition-[box-shadow,transform] duration-[850ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${isLead ? "scale-[1.03] shadow-[0_0_0_2px_var(--gold)]" : "shadow-[0_0_0_1px_rgba(201,162,74,0.42)] group-hover:scale-[1.03]"} max-[720px]:w-[min(86vw,22rem)]`}
              >
                <Image
                  src={path.image}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 302px, (max-width: 768px) 372px, 418px"
                  quality={100}
                  unoptimized
                  className={`object-cover transition-transform duration-[1150ms] ease-out ${isLead ? "scale-[1.07]" : "group-hover:scale-[1.07]"}`}
                  style={{ objectPosition: path.id === "here" ? "50% 48%" : "50% 42%" }}
                />
              </span>

              <h2 className="font-display text-[clamp(1.55rem,4.6vw,2.35rem)] font-medium leading-[1.08] tracking-[-0.02em]">
                {path.heading}
              </h2>

              <p className="mx-auto max-w-[16rem] text-[0.95rem] text-[var(--ivory-dim)]">
                {path.body}
              </p>
            </button>
          );
        })}
      </div>

      {/* Hidden until a path is chosen. */}
      <section
        ref={picksRef}
        id="go"
        hidden={chosen === null}
        className="picks mx-auto max-w-[34rem] scroll-mt-28 px-[1.15rem] pb-[0.4rem] pt-[1.1rem] text-center sm:px-8 sm:pb-[0.6rem] sm:pt-[1.4rem]"
      >
        {chosen === "away" ? (
          <>
            <p className="kicker mb-[0.85rem] text-[0.72rem] uppercase tracking-[0.2em] text-[var(--gold)]">
              Which restaurant?
            </p>

            {/* Straight out to that branch's Toast page — the card already
                says which restaurant, so there's nothing left to ask. */}
            <div className="pick-row mx-auto grid max-w-[28rem] grid-cols-2 gap-[0.55rem]">
              {LOCATIONS.map((location) => (
                <a
                  key={location.slug}
                  href={COLLECTION_URLS[location.slug as keyof typeof COLLECTION_URLS]}
                  target="_blank"
                  rel="noreferrer"
                  className="pick block border border-[rgba(201,162,74,.45)] px-[0.7rem] py-[1.05rem] font-display text-[1.35rem] tracking-[-0.02em] transition-colors hover:border-[var(--gold)] hover:text-[var(--gold)] max-[720px]:flex max-[720px]:min-h-[4.2rem] max-[720px]:flex-col max-[720px]:justify-center"
                >
                  {location.shortName}
                  <small className="mt-1 block font-body text-[0.62rem] font-normal uppercase tracking-[0.16em] text-[var(--ivory-dim)]">
                    Collection
                  </small>
                </a>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="kicker mb-[0.85rem] text-[0.72rem] uppercase tracking-[0.2em] text-[var(--gold)]">
              Which restaurant?
            </p>

            <div className="pick-row mx-auto grid max-w-[28rem] grid-cols-2 gap-[0.55rem]">
              {LOCATIONS.map((location) => (
                <button
                  key={location.slug}
                  type="button"
                  onClick={chooseBranch}
                  className="pick block border border-[rgba(201,162,74,.45)] px-[0.7rem] py-[1.05rem] font-display text-[1.35rem] tracking-[-0.02em] transition-colors hover:border-[var(--gold)] hover:text-[var(--gold)] max-[720px]:flex max-[720px]:min-h-[4.2rem] max-[720px]:flex-col max-[720px]:justify-center"
                >
                  {location.shortName}
                  <small className="mt-1 block font-body text-[0.62rem] font-normal uppercase tracking-[0.16em] text-[var(--ivory-dim)]">
                    {location.slug === "lewisham" ? "Flagship" : location.area}
                  </small>
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      {/* The newsletter, which lost its home when the footer changed. */}
      <section className="know mx-auto max-w-[34rem] px-[1.15rem] pb-[0.4rem] pt-[2.6rem] text-center sm:px-8 sm:pb-[0.6rem] sm:pt-12">
        <p className="mb-3 text-[0.72rem] uppercase tracking-[0.2em] text-[var(--gold)]">
          Stay close
        </p>

        <h2 className="mb-[0.55rem] font-display text-[clamp(1.7rem,5vw,2.5rem)] font-medium leading-[1.08] tracking-[-0.02em]">
          Know before everyone else.
        </h2>

        <p className="dek mx-auto mb-[1.2rem] max-w-[24rem] text-[var(--ivory-dim)]">
          New dishes, event nights and the odd thing we don&apos;t put on Instagram.
        </p>

        <NewsletterForm variant="order" />
      </section>

      <section id="book" className="mood px-[1.15rem] pb-16 pt-4 text-center sm:px-6">
        <p className="font-display text-[clamp(1.4rem,3vw,2rem)] italic">
          Always in the mood for you.
        </p>
      </section>

      <SiteFooter />
    </div>
  );
}

/**
 * Where the browser can't scan — iOS Safari, mostly. Their own camera app
 * does the same job, so say that plainly rather than apologising.
 */
function ScanPrompt({ onBack }: { onBack: () => void }) {
  return (
    <section className="mx-auto flex min-h-[80svh] max-w-[32rem] flex-col justify-center px-[1.15rem] py-24 text-center sm:px-6">
      <p className="mb-3 text-[0.72rem] uppercase tracking-[0.2em] text-[var(--gold)]">
        At the table
      </p>

      <h1 className="mb-4 font-display text-[clamp(1.9rem,6vw,2.6rem)] font-medium leading-tight">
        There&apos;s a code on your table.
      </h1>

      <p className="mb-8 leading-relaxed text-[var(--ivory-dim)]">
        Open your phone&apos;s camera and point it at the code. A link will pop up —
        tap it and the menu opens with your table already set.
      </p>

      <p className="mb-8 text-[0.9rem] text-[var(--muted)]">
        Can&apos;t find it? Ask any member of staff.
      </p>

      <button
        type="button"
        onClick={onBack}
        className="mx-auto border-b border-[rgba(201,162,74,.55)] pb-0.5 text-[0.85rem] text-[var(--ivory)] transition-colors hover:border-[var(--gold)] hover:text-[var(--gold)]"
      >
        Back
      </button>
    </section>
  );
}