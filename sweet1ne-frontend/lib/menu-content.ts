/**
 * The menu, built from the real backend list (`/public/site/menu`) — the
 * same dishes and photos staff edit on the Menu dashboard, and the same
 * list the table phone reads. This file only supplies the shapes and the
 * decorative, non-dish photography (course-disc emblems, chapter bleeds)
 * that the real menu has no field for; every dish, price, description and
 * photo below comes from the API, never invented here.
 */

export type Dish = {
  id: string;
  name: string;
  price?: string;
  description?: string;
  /** A dish with a real photo gets the circular thumbnail treatment. */
  featured?: boolean;
  image?: string;
};

export type Chapter = {
  id: string;
  kicker: string;
  heading?: string;
  lede?: string;
  /** Decorative only — set when the category name matches one of the
   *  curated house photo sets below. Not stored on the category itself. */
  mark?: string;
  markPosition?: string;
  bleed?: { src: string; alt: string };
  shots?: string[];
  dishes: Dish[];
};

export type PublicMenuItem = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  promo_price: number | null;
  picture: string | null;
  pictures: string[];
  main_category_id: string;
};

export type PublicCategory = { id: string; name: string; parent_id: string | null };

export type PublicMenuData = {
  categories: PublicCategory[];
  items: PublicMenuItem[];
  allergen_notice: string | null;
};

const PHOTO = "/images/homepage-gallery/menu";

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

/** Best-effort match from a real category's name to the house's curated,
 *  non-dish photography — the same static photos the template shipped
 *  with. A category that doesn't match any of these just lists plainly,
 *  same as "Sides" or "Kids" always did. */
const CURATED: { test: RegExp; mark: string; markPosition: string; bleed?: { src: string; alt: string }; shots?: string[] }[] = [
  { test: /starter/i, mark: `${PHOTO}/photo-starters.jpg`, markPosition: "48% 38%" },
  { test: /main/i, mark: `${PHOTO}/photo-mains.jpg`, markPosition: "50% 48%" },
  { test: /pasta/i, mark: `${PHOTO}/photo-pasta-prawns.jpg`, markPosition: "50% 46%" },
  {
    test: /seafood|boil/i,
    mark: `${PHOTO}/photo-seafood.jpg`,
    markPosition: "48% 55%",
    bleed: { src: `${PHOTO}/photo-boil-table.jpg`, alt: "Sweet1ne loaded seafood boil" },
  },
  { test: /dessert/i, mark: `${PHOTO}/photo-desserts.jpg`, markPosition: "40% 58%" },
  {
    test: /\bbar\b|drink|cocktail/i,
    mark: `${PHOTO}/photo-bar-globe.jpg`,
    markPosition: "50% 36%",
    shots: [`${PHOTO}/photo-bar-globe.jpg`, `${PHOTO}/photo-bar-umbrellas.jpg`, `${PHOTO}/photo-bar-rose.jpg`],
  },
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "chapter";
}

function priceLabel(item: PublicMenuItem): string {
  return gbp.format(item.promo_price ?? item.price);
}

/** Builds the chapter list from the real menu, and which chapters get a
 *  course-nav emblem (only the ones with curated photography — an
 *  unphotographed section is reached by scrolling, same as before). */
export function buildMenu(data: PublicMenuData): { chapters: Chapter[]; courseIds: string[] } {
  const mainCategories = data.categories.filter((c) => c.parent_id === null);
  const usedIds = new Set<string>();

  const chapters: Chapter[] = mainCategories.map((main) => {
    let id = slugify(main.name);
    while (usedIds.has(id)) id = `${id}-2`;
    usedIds.add(id);

    const dishes = data.items
      .filter((item) => item.main_category_id === main.id)
      .map((item) => ({
        id: item.id,
        name: item.title,
        price: priceLabel(item),
        description: item.description ?? undefined,
        featured: Boolean(item.picture),
        image: item.picture ?? undefined,
      }));

    const curated = CURATED.find((c) => c.test.test(main.name));

    return {
      id,
      kicker: main.name,
      mark: curated?.mark,
      markPosition: curated?.markPosition,
      bleed: curated?.bleed,
      shots: curated?.shots,
      dishes,
    };
  });

  const nonEmpty = chapters.filter((c) => c.dishes.length > 0);
  const courseIds = nonEmpty.filter((c) => c.mark).map((c) => c.id);

  return { chapters: nonEmpty, courseIds };
}

export const MENU_NOTE_FALLBACK =
  "Tell your server about allergies before you order. Not every ingredient is listed. Confirm with your server if you need to.";
