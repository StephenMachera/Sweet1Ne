import type { Metadata } from "next";
import { Hero } from "@/components/site/hero";
import { FactStrip } from "@/components/site/fact-strip";
import { SignatureDishes } from "@/components/site/signature-dishes";
import { StoryStrip } from "@/components/site/story-strip";
import { LocationsPreview } from "@/components/site/locations-preview";
import { SIGNATURE_DISHES } from "@/lib/site-content";
import { TheRoom } from "@/components/site/the-room";

export const metadata: Metadata = {
  // The layout's template appends "· Sweet1NE", so the homepage overrides
  // it with an absolute title rather than repeating the name twice.
  title: {
    absolute: "Sweet1NE — Afro-Caribbean Fusion, South East London",
  },
};

async function getLocations() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/public/site/locations`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const locations = await getLocations();

  return (
    <>
      <Hero />
      <FactStrip />
      <SignatureDishes dishes={SIGNATURE_DISHES} />
      <TheRoom />
      <StoryStrip />
      <LocationsPreview />
    </>
  );
}