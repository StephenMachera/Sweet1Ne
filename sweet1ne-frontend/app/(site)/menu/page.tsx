import type { Metadata } from "next";
import { MenuHero } from "@/components/site/menu-hero";
import { CourseNav } from "@/components/site/course-nav";
import { MenuChapters } from "@/components/site/menu-chapters";
import { buildMenu, type PublicMenuData } from "@/lib/menu-content";

export const metadata: Metadata = {
  title: "Menu",
  description: "The Sweet1NE menu. Book Lewisham or Chingford.",
};

async function getMenu(): Promise<PublicMenuData> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/public/site/menu`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return { categories: [], items: [], allergen_notice: null };
    return res.json();
  } catch {
    return { categories: [], items: [], allergen_notice: null };
  }
}

export default async function MenuPage() {
  const data = await getMenu();
  const { chapters, courseIds } = buildMenu(data);

  return (
    <div className="menu-page">
      <MenuHero />
      <CourseNav chapters={chapters} courseIds={courseIds} />
      <MenuChapters chapters={chapters} note={data.allergen_notice} />
    </div>
  );
}
