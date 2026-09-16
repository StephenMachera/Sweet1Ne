import type { Metadata } from "next";
import { MenuHero } from "@/components/site/menu-hero";
import { CourseNav } from "@/components/site/course-nav";
import { MenuChapters } from "@/components/site/menu-chapters";

export const metadata: Metadata = {
  title: "Menu",
  description:
    "Sweet1NE. Elevated Afro-Fusion. African and Caribbean dishes, with the indulgence of soul food. Book Lewisham or Chingford.",
};

export default function MenuPage() {
  return (
    <div className="menu-page">
      <MenuHero />
      <CourseNav />
      <MenuChapters />
    </div>
  );
}