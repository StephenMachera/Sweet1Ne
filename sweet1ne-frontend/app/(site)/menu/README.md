The live menu is database-driven — `page.tsx` fetches `/public/site/menu`
(no-store, so an admin's edit shows up immediately) and builds the page
via `lib/menu-content.ts` + `components/site/{menu-hero,course-nav,menu-chapters}.tsx`.

The only hand-maintained part is `menu-content.ts`'s `CURATED` table —
decorative photography (course-disc "mark", full-width "bleed" bands,
the drinks "shots" strip) that the real `MainCategory`/`SubCategory`
models have no field for (beyond a single `picture`, which `CURATED`
doesn't currently read). Update it by hand whenever a new photo pack
retires or adds one of these.
