"use client";

import Link from "next/link";
import { useStage } from "./stage-provider";

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

      {/* Class names from home.html — the mark, rule and buttons are styled
          and animated by the shared .gate-mark / .gate-acts / .book rules. */}
      <div className="gate-mark relative z-10">
        <img src="/images/homepage-gallery/story/logo.png" alt="Sweet1NE" />
        <hr />

        <div className="gate-acts">
          <button type="button" onPointerDown={enter} onClick={enter} className="book">
            Enter Sweet1NE
          </button>
          <Link href="/locations" className="book">
            Reservations
          </Link>
        </div>
      </div>
    </div>
  );
}