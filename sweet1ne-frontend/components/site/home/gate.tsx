"use client";

import Link from "next/link";
import { useStage } from "./stage-provider";

const BOOK =
  "font-body inline-block min-w-[10.5rem] cursor-pointer rounded-[3px] " +
  "border border-[rgba(201,162,74,0.9)] bg-transparent px-[1.15rem] py-[0.65rem] " +
  "text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[var(--gold)] no-underline " +
  "transition-colors duration-[400ms] ease-out " +
  "hover:bg-[var(--gold)] hover:text-[#0e0e0e] " +
  "focus-visible:bg-[var(--gold)] focus-visible:text-[#0e0e0e] focus-visible:outline-none";

/**
 * The logo sting over the films.
 *
 * Nothing is painted behind the mark but a translucent, blurred sheet — the
 * cinema underneath is live and autoplaying, and it's meant to be seen
 * starting through the blur. A still here would hide exactly that.
 */
export default function Gate() {
  const { gated, enter } = useStage();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Sweet1NE"
      aria-hidden={!gated}
      className={[
        "gate fixed inset-0 z-[200] grid place-items-center overflow-hidden",
        "bg-[rgba(5,5,5,0.72)] backdrop-blur-[8px]",
        "transition-opacity duration-[450ms] ease-out motion-reduce:hidden",
        gated ? "opacity-100" : "pointer-events-none opacity-0",
      ].join(" ")}
      style={{
        visibility: gated ? "visible" : "hidden",
        transitionProperty: "opacity, visibility",
      }}
    >

      <div className="relative z-10 max-w-[min(90vw,28rem)] px-5 text-center">
        <img
          src="/images/homepage-gallery/story/logo.png"
          alt="Sweet1NE"
          className="mx-auto h-auto w-[min(58vw,196px)] opacity-0 drop-shadow-[0_8px_28px_rgba(0,0,0,0.55)] sm:w-[min(52vw,236px)]"
          style={{ animation: "gateLogo 0.55s ease forwards" }}
        />
        <hr
          className="mx-auto mt-[1.05rem] h-px w-[2.2rem] border-0 bg-[var(--gold)] opacity-0"
          style={{ animation: "gateFade 0.35s ease 0.28s forwards" }}
        />

        <div
          className="mt-[1.45rem] flex flex-wrap justify-center gap-y-[0.7rem] gap-x-[0.85rem] opacity-0"
          style={{ animation: "gateFade 0.4s ease 0.4s forwards" }}
        >
          <button
            type="button"
            onPointerDown={enter}
            onClick={enter}
            className={BOOK}
          >
            Enter Sweet1NE
          </button>
          <Link href="/locations" className={BOOK}>
            Book a table
          </Link>
        </div>
      </div>
    </div>
  );
}