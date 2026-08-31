import type { Metadata } from "next";
import { Bodoni_Moda, Hanken_Grotesk } from "next/font/google";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { SmoothScroll } from "@/components/site/motion/smooth-scroll";
import { EventPopup } from "@/components/site/event-popup";
import { Analytics } from "@/components/site/analytics";
import { CookieConsent } from "@/components/site/cookie-consent";
import "./site.css";

const display = Bodoni_Moda({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600"],
});

const body = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "Sweet1NE — Afro-Caribbean Fusion, South East London",
    template: "%s · Sweet1NE",
  },
  description:
    "Afro-Caribbean fusion done loud. Seafood boils, sharing platters and soul food twists. 100% Halal. Two London locations.",
  openGraph: {
    type: "website",
    siteName: "Sweet1NE",
    title: "Sweet1NE — Afro-Caribbean Fusion, South East London",
    description:
      "Seafood boils, sharing platters, soul food twists. 100% Halal. Two London locations.",
    images: ["/images/brand/og.jpg"],
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${display.variable} ${body.variable} site-root min-h-screen bg-[#0e0e0e] font-body text-[#e5e2e1] antialiased`}
    >
      <SmoothScroll>
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </SmoothScroll>
      <EventPopup />
      <CookieConsent />
      <Analytics />
    </div>
  );
}