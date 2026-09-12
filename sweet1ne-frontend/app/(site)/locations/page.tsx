import type { Metadata } from "next";
import { VenueJump } from "@/components/site/venue-jump";
import { VenueCards } from "@/components/site/venue-cards";
import { SiteFooter } from "@/components/site/site-footer";

export const metadata: Metadata = {
  title: "Find Us",
  description:
    "Sweet1NE in Lewisham and Chingford — addresses, opening hours and how to get there.",
};

export default function FindUsPage() {
  return (
    <>
      <VenueJump />
      <VenueCards />

      <section className="px-[1.15rem] pb-12 pt-6 text-center sm:px-6">
        <p className="font-display text-[clamp(1.4rem,3vw,2rem)] italic">
          Always in the mood for you.
        </p>
      </section>

      <SiteFooter />
    </>
  );
}