import type { Metadata } from "next";
import { EventsHero } from "@/components/site/event-hero";
import { EventsPaths } from "@/components/site/event-paths";
import { EventsNext } from "@/components/site/events-next";
import { SiteFooter } from "@/components/site/site-footer";

export const metadata: Metadata = {
  title: "Events",
  description:
    "Nights at Sweet1NE. Book a table in Lewisham or Chingford, or write for private hire.",
};

export default function EventsPage() {
  return (
    <div className="events-page">
      <EventsHero />
      <EventsPaths />
      <EventsNext />
      <SiteFooter />
    </div>
  );
}