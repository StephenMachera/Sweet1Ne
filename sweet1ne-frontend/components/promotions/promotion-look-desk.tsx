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
    label: "Opening page",
    cap: "Centred on the film, above the room words. Quiet line stays under the header. Not on the gate.",
    frameClass: "is-enter",
  },
  ribbon: {
    label: "Quiet line",
    cap: "Short line under the header: still, kicker, title, and the buttons that are on. They can close it. The longer copy stays on the opening page and the QR app.",
    frameClass: "is-ribbon",
  },
  phone: {
    label: "QR app",
    cap: "After email, under the table name: still, kicker, title, and copy. A code shows here and comes off the basket. Basket stays at the bottom.",
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
      className={`admin-look-frame ${frameClass}${on ? " is-on" : " is-off"}${interactive ? " is-interactive" : ""}`}
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
      <div className={`admin-look-content${on ? "" : " is-off"}`}>
        {children}
      </div>
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
  // Shown on the "enter" surface only (the one photo surface) when no hero
  // image has been picked yet — the tenant's own most recent upload, same
  // convention as the Campaigns letter preview.
  defaultImage?: string;
  // A real guest order page URL (branch slug + a real table's QR token) —
  // the "QR app" frame's actual destination. Null until a branch/table is
  // known yet, in which case it falls back to the public /menu page.
  phoneSrc?: string | null;
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
  defaultImage,
  phoneSrc,
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
          <div className="admin-look-site-frame" aria-hidden>
            {/* No veil here — the real homepage already dims its own hero
               for text legibility, so layering another one on top just
               muddies it instead of looking like the real page. */}
            <iframe src="/" scrolling="no" tabIndex={-1} loading="lazy" title="" />
          </div>
          <PromotionPreview data={data} surface="enter" defaultImage={defaultImage} />
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
        <div className="admin-look-ribbon-stage">
          <div className="admin-look-site-frame" aria-hidden>
            <iframe src="/" scrolling="no" tabIndex={-1} loading="lazy" title="" />
          </div>
          <PromotionPreview data={data} surface="ribbon" />
        </div>
        <p className="admin-look-ribbon-rest">
          The rooms, the menu, What&rsquo;s next — the line stays under the header.
        </p>
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
          <div className="admin-look-handset-bar">
            <img src={LOGO_SRC} alt="" />
            <span>Lewisham · Table 12</span>
          </div>
          <div className="admin-look-handset-stage">
            <div className="admin-look-handset-frame" aria-hidden>
              <iframe src={phoneSrc || "/menu"} scrolling="no" tabIndex={-1} loading="lazy" title="" />
            </div>
            <div className="admin-look-site-veil" aria-hidden />
            <PromotionPreview data={data} surface="phone" />
          </div>
          <div className="admin-look-handset-dock">{dockText}</div>
        </div>
      </Frame>
    </div>
  );
}
