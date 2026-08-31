/**
 * Nocturne & Gold — the public site's design tokens.
 *
 * Kept separate from the staff palettes in globals.css because the two
 * surfaces share nothing: the staff app optimises for scanning data, this
 * one for atmosphere.
 */

export const site = {
  // Surfaces, darkest to lightest. Depth comes from these tiers rather
  // than shadows.
  bg: "#0e0e0e",
  surface: "#131313",
  surfaceLow: "#1c1b1b",
  surfaceMid: "#201f1f",
  surfaceHigh: "#2a2a2a",

  // Text
  ivory: "#e5e2e1",
  ivoryDim: "#cfc6af",
  muted: "#98907b",

  // Brand
  gold: "#f6d24c",
  goldDeep: "#d8b632",
  onGold: "#3b2f00",

  // Hairline borders — never solid, never shadows.
  hairline: "rgba(216,182,50,0.28)",
  hairlineFaint: "rgba(216,182,50,0.12)",
} as const;