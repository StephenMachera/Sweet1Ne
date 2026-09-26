import { StageProvider } from "@/components/site/home/stage-provider";
import Cinema from "@/components/site/home/cinema";
import { PromoCard } from "@/components/site/home/promo-card";
import House from "@/components/site/home/house";
import Plates from "@/components/site/home/plates";
import Mood from "@/components/site/home/mood";
import { SiteFooter } from "@/components/site/site-footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sweet1NE — Always in the mood for you",
  description:
    "Sweet1NE. Elevated Afro-Caribbean fusion in Lewisham and Chingford. A culinary adventure for all the senses. Always in the mood for you.",
};

export default function HomePage() {
  return (
    <StageProvider>
      {/* Every homepage rule in site.css is scoped under .home-page — the
          gate, cinema, house, plates, mood line and the ghost buttons all
          depend on this wrapper. The header comes from the (site) layout;
          rendering it here as well puts two on the page. */}
      <div className="home-page">
        <Cinema />
        <PromoCard />
        <House />
        <Plates />
        <Mood />
        <SiteFooter />
      </div>
    </StageProvider>
  );
}