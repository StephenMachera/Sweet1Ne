import type { Metadata } from "next";
import { HomeShell } from "@/components/site/home-shell";

export const metadata: Metadata = {
  title: {
    absolute: "Sweet1NE — Elevated Afro-Caribbean Fusion, London",
  },
  description:
    "A culinary adventure for all the senses. African, Caribbean and American soul food, at Lewisham and Chingford.",
};

export default function HomePage() {
  return <HomeShell />;
}