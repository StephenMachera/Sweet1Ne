The live menu is a hardcoded placeholder (page.tsx + lib/menu-content.ts),
because the real items aren't in the database yet.

To switch back once they are:
  1. Delete page.tsx
  2. Rename page-database.tsx.bak to page.tsx
  3. It uses components/site/menu-grid.tsx, which is still in place
