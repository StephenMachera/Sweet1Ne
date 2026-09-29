"use client";

import type { ReactNode } from "react";
import {
  PromotionPreview,
  type PromotionPreviewData,
} from "./promotion-preview";

const LOGO_SRC = "/images/brand/logo.png";

export type SurfaceKey = "enter" | "ribbon" | "phone";

const SURFACE_COPY: Record<
  SurfaceKey,
  { label: string; cap: string; frameClass: string }
> = {
  enter: {
    label: "After they enter",
    cap: "Homepage, after Enter Sweet1NE. Not on the film.",
    frameClass: "is-enter",
  },
  ribbon: {
    label: "Quiet line",
    cap: "Under the header until they close it.",
    frameClass: "is-ribbon",
  },
  phone: {
    label: "Table phone",
    cap: "After email. A live code comes off the basket.",
    frameClass: "is-phone",
  },
};

function Frame({
  label,
  cap,
  frameClass,
  on,
  interactive,
  onToggle,
  children,
}: {
  label: string;
  cap?: string;
  frameClass: string;
  on: boolean;
  interactive: boolean;
  onToggle?: () => void;
  children: ReactNode;
}) {
  return (
    <section
      className={`admin-look-frame ${frameClass}${on ? " is-on" : ""}${interactive ? " is-interactive" : ""}`}
      onClick={interactive ? onToggle : undefined}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onToggle?.();
              }
            }
          : undefined
      }
    >
      <p className="admin-look-kicker">
        {label} <span className="admin-look-state">{on ? "On" : "Off"}</span>
      </p>
      {cap && <p className="admin-look-cap">{cap}</p>}
      {children}
    </section>
  );
}

type PromotionLookDeskProps = {
  data: PromotionPreviewData;
  surfaces: Record<SurfaceKey, boolean>;
  interactive: boolean;
  onToggleSurface?: (key: SurfaceKey) => void;
  kind: string;
  code: string | null;
  offer: string;
  off: number | null;
};

/** The Look desk — one frame per real surface a promotion can appear on
   (after they enter, the quiet line, the table phone), each with enough
   chrome (the phone's own bar, the site's own header) that staff can tell
   where it actually sits. Interactive only while editing: tapping a frame
   there toggles that surface directly. Browsing an existing promotion's
   frames is read-only. No letter surface and no paid-tile desk here — a
   letter goes through Marketing's own preview, and paid tiles aren't a
   thing this page shows. */
export function PromotionLookDesk({
  data,
  surfaces,
  interactive,
  onToggleSurface,
  kind,
  code,
  offer,
  off,
}: PromotionLookDeskProps) {
  const dockText =
    kind === "code" && code
      ? offer !== "none" && off
        ? `Basket · ${code} comes off the total`
        : `Basket · ${code} is on this table`
      : "Basket";

  return (
    <div className="admin-look-desk">
      <Frame
        label={SURFACE_COPY.enter.label}
        cap={SURFACE_COPY.enter.cap}
        frameClass={SURFACE_COPY.enter.frameClass}
        on={surfaces.enter}
        interactive={interactive}
        onToggle={() => onToggleSurface?.("enter")}
      >
        <div className="admin-promo-film">
          <PromotionPreview data={data} surface="enter" />
        </div>
      </Frame>

      <Frame
        label={SURFACE_COPY.ribbon.label}
        cap={SURFACE_COPY.ribbon.cap}
        frameClass={SURFACE_COPY.ribbon.frameClass}
        on={surfaces.ribbon}
        interactive={interactive}
        onToggle={() => onToggleSurface?.("ribbon")}
      >
        <div className="admin-look-header">
          <img src={LOGO_SRC} alt="Sweet1NE" />
          <span>The List · Find Us · Events</span>
        </div>
        <PromotionPreview data={data} surface="ribbon" />
      </Frame>

      <Frame
        label={SURFACE_COPY.phone.label}
        cap={SURFACE_COPY.phone.cap}
        frameClass={SURFACE_COPY.phone.frameClass}
        on={surfaces.phone}
        interactive={interactive}
        onToggle={() => onToggleSurface?.("phone")}
      >
        <div className="admin-look-handset">
          <div className="admin-look-handset-bar">Lewisham · Table 12</div>
          <PromotionPreview data={data} surface="phone" />
          <div className="admin-look-handset-dock">{dockText}</div>
        </div>
      </Frame>
    </div>
  );
}
