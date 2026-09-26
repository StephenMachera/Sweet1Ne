"use client";

import type { ReactNode } from "react";
import { PromotionPreview, type PromotionPreviewData } from "./promotion-preview";

const LOGO_SRC = "/images/brand/logo.png";

export type SurfaceKey = "enter" | "ribbon" | "phone" | "mail";
export type ChannelKey = "google" | "meta" | "instagram";

const SURFACE_COPY: Record<SurfaceKey, { label: string; cap: string }> = {
  enter: { label: "After they enter", cap: "Homepage, after Enter Sweet1NE. Not on the film." },
  ribbon: { label: "Quiet line", cap: "Under the header until they close it." },
  phone: { label: "Table phone", cap: "After the menu. A live code comes off the basket." },
  mail: { label: "A letter", cap: "Marketing, people who asked. UK PECR." },
};

function Frame({
  label,
  cap,
  on,
  interactive,
  onToggle,
  children,
}: {
  label: string;
  cap?: string;
  on: boolean;
  interactive: boolean;
  onToggle?: () => void;
  children: ReactNode;
}) {
  return (
    <section
      className={`admin-look-frame${on ? " is-on" : ""}${interactive ? " is-interactive" : ""}`}
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
  channels: Record<ChannelKey, boolean>;
  interactive: boolean;
  onToggleSurface?: (key: SurfaceKey) => void;
  onToggleChannel?: (key: ChannelKey) => void;
  kind: string;
  code: string | null;
  offer: string;
  off: number | null;
};

/** The Look desk — one frame per real surface a promotion can appear on,
   each with enough chrome (the phone's own bar, the site's own header) that
   staff can tell where it actually sits, plus a second desk previewing the
   same words as a paid tile. Interactive only while editing: tapping a
   frame there toggles that surface/channel directly, mirroring the
   reference build's look-desk exactly. Browsing an existing promotion's
   frames is read-only. */
export function PromotionLookDesk({
  data,
  surfaces,
  channels,
  interactive,
  onToggleSurface,
  onToggleChannel,
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
    <>
      <div className="admin-look-desk">
        <Frame
          label={SURFACE_COPY.enter.label}
          cap={SURFACE_COPY.enter.cap}
          on={surfaces.enter}
          interactive={interactive}
          onToggle={() => onToggleSurface?.("enter")}
        >
          <div className="admin-promo-film">
            <PromotionPreview data={data} />
          </div>
        </Frame>

        <Frame
          label={SURFACE_COPY.ribbon.label}
          cap={SURFACE_COPY.ribbon.cap}
          on={surfaces.ribbon}
          interactive={interactive}
          onToggle={() => onToggleSurface?.("ribbon")}
        >
          <div className="admin-look-header">
            <img src={LOGO_SRC} alt="Sweet1NE" />
            <span>The List · Find Us · Events</span>
          </div>
          <PromotionPreview data={data} />
        </Frame>

        <Frame
          label={SURFACE_COPY.phone.label}
          cap={SURFACE_COPY.phone.cap}
          on={surfaces.phone}
          interactive={interactive}
          onToggle={() => onToggleSurface?.("phone")}
        >
          <div className="admin-look-handset">
            <div className="admin-look-handset-bar">Lewisham · Table 12</div>
            <PromotionPreview data={data} />
            <div className="admin-look-handset-dock">{dockText}</div>
          </div>
        </Frame>

        <Frame
          label={SURFACE_COPY.mail.label}
          cap={SURFACE_COPY.mail.cap}
          on={surfaces.mail}
          interactive={interactive}
          onToggle={() => onToggleSurface?.("mail")}
        >
          <PromotionPreview data={data} />
        </Frame>
      </div>

      <div className="admin-board-group">
        <h2>Paid tiles</h2>
        <p className="admin-dek">Tap to put the same words on Google, Meta or Instagram. Not live ads.</p>
      </div>
      <div className="admin-paid-desk">
        {(["google", "meta", "instagram"] as ChannelKey[]).map((key) => (
          <Frame
            key={key}
            label={key[0].toUpperCase() + key.slice(1)}
            on={channels[key]}
            interactive={interactive}
            onToggle={() => onToggleChannel?.(key)}
          >
            <PromotionPreview data={data} />
          </Frame>
        ))}
      </div>
    </>
  );
}
