import type { Metadata } from "next";
import { EventsHero } from "@/components/site/event-hero";
import { EventsPaths } from "@/components/site/event-paths";
import { EventsNext } from "@/components/site/events-next";
import { SiteFooter } from "@/components/site/site-footer";

export const metadata: Metadata = {
  title: "Events",
  description:
    "A table. The room. A performance. Book a night at Sweet1NE, or take the room for your own.",
};

export default function EventsPage() {
  return (
    <>
      <EventsHero />
      <EventsPaths />
      <EventsNext />
      <SiteFooter />
    </>
  );
}