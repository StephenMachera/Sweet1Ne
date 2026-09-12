"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { QrScanner, scannerSupported } from "./qr-scanner";
import { TakeawayFlow } from "./takeaway-flow";
import { NewsletterForm } from "./newsletter-form";
import { SiteFooter } from "./site-footer";
import { LOCATIONS } from "@/lib/site-content";

type Path = "here" | "away";
type Stage = "choosing" | "scan-prompt" | "scanning" | "takeaway";

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

  const [lead, setLead] = useState<Path | null>(null);
  const [chosen, setChosen] = useState<Path | null>(null);
  const [stage, setStage] = useState<Stage>("choosing");
  const [branchSlug, setBranchSlug] = useState<string | null>(null);
  const [canScan, setCanScan] = useState(false);

  useEffect(() => {
    setCanScan(scannerSupported());
  }, []);

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

  function chooseBranch(slug: string) {
    setBranchSlug(slug);

    if (chosen === "away") {
      setStage("takeaway");
    } else {
      // Dine-in: scan if the browser can, otherwise tell them to use their
      // own camera.
      setStage(canScan ? "scanning" : "scan-prompt");
    }
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

  if (stage === "takeaway") {
    return (
      <TakeawayFlow
        initialBranchSlug={branchSlug ?? undefined}
        onBack={() => setStage("choosing")}
      />
    );
  }

  if (stage === "scan-prompt") {
    return <ScanPrompt onBack={() => setStage("choosing")} />;
  }

  return (
    <>
      <section className="mx-auto max-w-[54rem] px-[1.15rem] pb-6 pt-[6.5rem] text-center sm:px-6 sm:pt-[7.5rem]">
        <p className="mb-3 text-[0.72rem] uppercase tracking-[0.2em] text-[var(--gold)]">
          Order
        </p>

        <h1 className="mb-3.5 font-display text-[clamp(2.2rem,6vw,3.6rem)] font-medium leading-[1.05] tracking-[-0.02em]">
          Where are you eating.
        </h1>

        <p className="mx-auto max-w-[28rem] text-[var(--ivory-dim)]">
          At the table, or taking it away.
          <br />
          Lewisham or Chingford.
        </p>
      </section>

      {/* The two paths. Offset slightly on desktop so they sit off-axis
          rather than level — the detail that stops them reading as buttons. */}
      <div
        aria-label="How you're ordering"
        className="mx-auto flex max-w-[54rem] flex-col items-center gap-[0.7803rem] px-[1.15rem] pb-10 sm:px-6 md:flex-row md:items-start md:justify-center md:gap-[0.7803rem]"
      >
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
              className={`w-full max-w-[20rem] cursor-pointer border-0 bg-transparent p-0 text-center transition-opacity duration-[650ms] md:max-w-none md:flex-1 ${
                isLead ? "opacity-100" : "opacity-60 hover:opacity-85"
              } ${lead !== null ? (i === 0 ? "md:translate-y-[0.7rem]" : "md:-translate-y-[0.35rem]") : ""}`}
            >
              <span
                className={`relative mx-auto block aspect-square overflow-hidden rounded-full transition-all duration-[650ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${
                  lead === null
                    ? "w-[18.876rem] sm:w-[23.232rem] md:w-[26.136rem]"
                    : isLead
                      ? "w-[18.876rem] sm:w-[23.232rem] md:w-[26.136rem]"
                      : "w-[15.972rem] sm:w-[19.602rem] md:w-[23.232rem]"
                }`}
                style={{
                  boxShadow: isLead
                    ? "0 0 0 2px var(--gold)"
                    : "0 0 0 1px rgba(201,162,74,.35)",
                }}
              >
                <Image
                  src={path.image}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 302px, (max-width: 768px) 372px, 418px"
                  quality={100}
                  unoptimized
                  className="object-cover"
                />
              </span>

              <h2 className="mt-5 font-display text-[1.35rem] font-medium leading-tight sm:text-[1.6rem]">
                {path.heading}
              </h2>

              <p className="mx-auto mt-2 max-w-[18rem] text-[0.92rem] leading-relaxed text-[var(--ivory-dim)]">
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
        className="mx-auto max-w-[40rem] scroll-mt-28 px-[1.15rem] pb-12 text-center sm:px-6"
      >
        <p className="mb-5 text-[0.72rem] uppercase tracking-[0.2em] text-[var(--gold)]">
          Which restaurant?
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          {LOCATIONS.map((location) => (
            <button
              key={location.slug}
              type="button"
              onClick={() => chooseBranch(location.slug)}
              className="flex-1 border border-[rgba(201,162,74,.45)] px-6 py-5 font-display text-[1.25rem] font-medium transition-colors hover:border-[var(--gold)] hover:bg-[var(--gold)] hover:text-[#0e0e0e]"
              style={{ borderRadius: "4px" }}
            >
              {location.shortName}
              <small className="mt-1 block text-[0.66rem] font-normal uppercase tracking-[0.14em] opacity-70">
                {/* The second line changes with the path — same card, the
                    context it's in decides what it says. */}
                {chosen === "away"
                  ? "Collection"
                  : location.slug === "lewisham"
                    ? "Flagship"
                    : location.area}
              </small>
            </button>
          ))}
        </div>
      </section>

      {/* The newsletter, which lost its home when the footer changed. */}
      <section className="mx-auto max-w-[34rem] border-t border-[rgba(229,226,225,.08)] px-[1.15rem] py-14 text-center sm:px-6">
        <p className="mb-3 text-[0.72rem] uppercase tracking-[0.2em] text-[var(--gold)]">
          Stay close
        </p>

        <h2 className="mb-3 font-display text-[clamp(1.6rem,4vw,2.3rem)] font-medium leading-tight">
          Know before everyone else.
        </h2>

        <p className="mx-auto mb-7 max-w-[26rem] text-[var(--ivory-dim)]">
          New dishes, event nights and the odd thing we don't put on Instagram.
        </p>

        <NewsletterForm />
      </section>

      <section id="book" className="px-[1.15rem] pb-16 pt-4 text-center sm:px-6">
        <p className="font-display text-[clamp(1.4rem,3vw,2rem)] italic">
          Always in the mood for you.
        </p>
      </section>

      <SiteFooter />
    </>
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
        There's a code on your table.
      </h1>

      <p className="mb-8 leading-relaxed text-[var(--ivory-dim)]">
        Open your phone's camera and point it at the code. A link will pop up —
        tap it and the menu opens with your table already set.
      </p>

      <p className="mb-8 text-[0.9rem] text-[var(--muted)]">
        Can't find it? Ask any member of staff.
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