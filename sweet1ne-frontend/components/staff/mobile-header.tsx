"use client";

import { Menu } from "lucide-react";

export function MobileHeader({ title, onOpenMenu }: { title: string; onOpenMenu: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-ink/10 bg-paper/95 px-4 py-3 backdrop-blur md:hidden">
      <button
        onClick={onOpenMenu}
        aria-label="Open menu"
        className="-ml-1 rounded-md p-2 text-ink hover:bg-ink/5"
      >
        <Menu size={22} />
      </button>
      <h1 className="truncate font-display text-lg text-ink">{title}</h1>
    </header>
  );
}