---
name: Nocturne & Gold
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#cfc6af'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#98907b'
  outline-variant: '#4c4635'
  surface-tint: '#e7c43f'
  primary: '#f6d24c'
  on-primary: '#3b2f00'
  primary-container: '#d8b632'
  on-primary-container: '#584800'
  inverse-primary: '#715c00'
  secondary: '#c9c6be'
  on-secondary: '#31302b'
  secondary-container: '#484740'
  on-secondary-container: '#b8b5ad'
  tertiary: '#f8d15e'
  on-tertiary: '#3d2f00'
  tertiary-container: '#dab546'
  on-tertiary-container: '#5b4700'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffe17a'
  primary-fixed-dim: '#e7c43f'
  on-primary-fixed: '#231b00'
  on-primary-fixed-variant: '#554500'
  secondary-fixed: '#e6e2d9'
  secondary-fixed-dim: '#c9c6be'
  on-secondary-fixed: '#1c1c16'
  on-secondary-fixed-variant: '#484740'
  tertiary-fixed: '#ffe08c'
  tertiary-fixed-dim: '#e9c352'
  on-tertiary-fixed: '#241a00'
  on-tertiary-fixed-variant: '#584400'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-lg:
    fontFamily: Bodoni Moda
    fontSize: 72px
    fontWeight: '400'
    lineHeight: 80px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Bodoni Moda
    fontSize: 48px
    fontWeight: '400'
    lineHeight: 56px
  headline-lg-mobile:
    fontFamily: Bodoni Moda
    fontSize: 32px
    fontWeight: '400'
    lineHeight: 40px
  headline-md:
    fontFamily: Bodoni Moda
    fontSize: 32px
    fontWeight: '400'
    lineHeight: 40px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-caps:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.1em
  price-display:
    fontFamily: Bodoni Moda
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 20px
  section-gap-desktop: 120px
  section-gap-mobile: 64px
---

###  Brand & Style

The design system is a "Nocturnal Editorial" aesthetic designed for Sweet1neLIVE. It prioritises high-contrast cinematic visuals, evoking the atmosphere of a premium jazz club or high-end evening lounge. The personality is sophisticated, mature, and entertainment-led, moving away from high-energy "club" tropes towards a more curated, late-night performance experience.

The style is a blend of **Minimalism** and **Tactile Luxury**. It relies on deep blacks, warm champagne golds, and expansive whitespace (or "blackspace") to create a sense of exclusivity. Visual elements are refined with thin, hairline borders and generous letter spacing to evoke a sense of quiet confidence and premium service.

## Colors

The palette is anchored in a "Nocturnal" base. The primary background (#050505) provides a deep, near-black canvas that allows photography and gold accents to pop.

- **Brand Gold (#D8B632):** Used sparingly for primary calls to action, active states, and brand highlights.
- **Soft Ivory (#F7F3EA):** Used for primary typography to ensure high readability without the harshness of pure white.
- **Surface Tiers:** Use #111111 for cards and sections, and #191714 for interactive elements or secondary containers to provide subtle depth without traditional shadows.
- **Functional Colors:** Success and Error states are heavily desaturated to remain cohesive with the luxurious atmosphere.

## Typography

This design system uses a high-contrast typographic pairing to balance editorial flair with modern utility.

- **Headlines:** Bodoni Moda provides a high-contrast, elegant serif look. Use it for performance titles, menu categories, and emotive marketing copy.
- **Body & UI:** Hanken Grotesk is a clean, contemporary sans-serif. It handles all functional data: descriptions, reservation details, and form labels.
- **Editorial Touch:** Use the `label-caps` style for small metadata (e.g., "LIVE MUSIC", "DOORS OPEN") with generous letter spacing to enhance the premium feel.
- **Currency:** Prices should be set in Bodoni Moda to elevate them from functional text to a premium detail.

## Layout & Spacing

The layout philosophy is **Editorial and Spacious**. It avoids the cramped density of typical web apps, opting for a relaxed, rhythmic flow that mirrors a high-end physical programme.

- **Grid:** Use a 12-column fluid grid for desktop with 24px gutters.
- **Sectioning:** Vertical spacing is intentionally large (120px on desktop) to allow high-quality photography to "breathe" between content blocks.
- **Alignment:** Centralise primary headlines and call-to-actions to create a sense of formal presentation.
- **Mobile:** Reflow to a single column with 20px side margins. Maintain significant vertical gaps between elements to preserve the premium feel on smaller screens.

## Elevation & Depth

This design system eschews heavy shadows in favour of **Tonal Layering** and **Fine Outlines**.

- **Depth:** Surfaces are defined by their hex values (#050505 to #111111). Higher elevation is represented by lighter, warmer dark-tones, not shadows.
- **Borders:** Use the `border_gold` (rgba(216,182,50,0.28)) for all card boundaries and separators. These should be 1px "hairline" strokes.
- **Active State:** Rather than a shadow, an active card or focused input should increase its border opacity or transition to a solid #D8B632 stroke.
- **Atmospheric Depth:** Use soft, large-scale radial gradients (Brand Gold at 5% opacity) behind key images to simulate warm ambient spotlighting.

## Shapes

The shape language is **Refined and Structured**

- **Corners:** A `0.25rem` (4px) radius is used for standard UI components like buttons and inputs. This provides a "softened architectural" look that is cleaner than sharp corners but more professional than round ones.
- **Imagery:** Large hero images should remain sharp (0px radius) to maintain a cinematic, edge-to-edge feel.
- **Interactive Elements:** Use the `Soft` setting for small components (chips, tags) to distinguish them from the more rigid layout structure.

## Components

## Buttons

**Primary:** Brand Gold background (#D8B632) with near-black text (#050505). No shadows. 4px rounded corners.
**Secondary:** Transparent background with a 1px Soft Ivory border. Text in Soft Ivory.
**Tertiary/Action:** Soft Ivory text with a 1px underline positioned 4px below the baseline. On hover, the underline should expand or change colour to Brand Gold.

### Cards & Surfaces

**Performance Card:** Surface Elevated (#111111) with a hairline gold border. Images should be the primary focus, with Bodoni Moda headlines.
**Menu Items:** Use a simple list format with the price in Brand Gold. Avoid card containers for menus; use whitespace and subtle dividers instead.

### Inputs & Forms

**Fields:** Surface Secondary (#191714) with an Ivory label above. The border should only appear on focus, using the Brand Gold.
**Checkboxes:** Square with a 2px radius. When checked, the fill is Brand Gold with a dark tick.

### Feedback & Motion

**Transitions:** Use "Long & Smooth" transitions (400ms ease-out) for page reveals.
**Hover States:** Elements should subtly shift in opacity or brightness rather than scale or move, maintaining a "still and calm" interface.
**Icons:** Use thin-stroke (1px) linear icons in Soft Ivory. Avoid filled or "playful" icon sets