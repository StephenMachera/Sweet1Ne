import type { Metadata } from "next";
import { Hero } from "@/components/site/hero";
import { TheNight } from "@/components/site/the-night";
import { KitchenBand } from "@/components/site/kitchen-band";
import { Restaurants } from "@/components/site/restaurants";
import { Mood } from "@/components/site/mood";

export const metadata: Metadata = {
  title: {
    absolute: "Sweet1NE — Afro-Caribbean Fusion, South East London",
  },
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <TheNight />
      <KitchenBand />
      <Restaurants />
      <Mood />
    </>
  );
}