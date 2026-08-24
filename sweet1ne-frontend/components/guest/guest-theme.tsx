"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const THEME_KEY = "sweet1ne_guest_theme";

export type GuestTheme = "light" | "dark";

export function useGuestTheme() {
  const [theme, setTheme] = useState<GuestTheme>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_KEY) as GuestTheme | null;
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
    } else {
      // No preference saved — follow the device.
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setTheme(prefersDark ? "dark" : "light");
    }
    setReady(true);
  }, []);

  function toggle() {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      window.localStorage.setItem(THEME_KEY, next);
      return next;
    });
  }

  return { theme, toggle, ready };
}

export function ThemeToggle({ theme, onToggle }: { theme: GuestTheme; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-guest-border bg-guest-card text-guest-muted transition-colors hover:text-guest-text"
    >
      {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
    </button>
  );
}