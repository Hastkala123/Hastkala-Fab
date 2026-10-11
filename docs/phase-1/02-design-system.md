# 02 — Design system (Sanganeri-inspired)

The brand colours already in `src/app/globals.css` come straight from the craft (indigo vat, madder root, turmeric, undyed cotton), and they're good. We keep them, add a sage green, and formalise how each colour is used.

A visual preview of this system (style guide, homepage, phone product page, admin product editor): https://claude.ai/artifact/K3JzuooLvaRMZNCM6FiVcH

## Colour

| Token (Tailwind) | Hex | Role |
|---|---|---|
| `cotton-50` | `#fdfbf7` | Page background (undyed cotton) |
| `cotton-100` / `200` | `#faf6ee` / `#f3ebdc` | Section bands, cards on cotton, input fills |
| `cotton-300` | `#e8dcc5` | Borders, dividers |
| `indigo-ink-950` | `#0e1a2b` | Body text, headings |
| `indigo-ink-800` | `#1e3a5f` | Primary buttons, header, links |
| `madder-600` | `#b34733` | Accent: Buy Now, sale %, required marks, errors |
| `turmeric-700` | `#865c1c` | Gold text (ratings, "Hand-block" badge text) |
| `turmeric-200` / `400` | `#f4df95` / `#e5b23a` | Gold fills, highlights, stars (fill only, never text) |
| **`sage-700`** (new) | `#4a674e` | Success, "In stock", eco/natural-dye notes |
| `sage-100` (new) | `#e7efe6` | Success backgrounds |

**Measured contrast (WCAG 2.2):**

| Pair | Ratio | Use allowed |
|---|---|---|
| indigo-ink-950 on cotton-50 | 16.9 : 1 | All text |
| indigo-ink-800 on cotton-50 | 11.1 : 1 | All text |
| white on indigo-ink-800 | 11.5 : 1 | Button text |
| madder-600 on white / cotton-50 | 5.4 / 5.3 : 1 | All text |
| white on madder-600 | 5.4 : 1 | Button text |
| turmeric-700 on white | 5.9 : 1 | All text |
| turmeric-600 on white | 3.7 : 1 | Large text / icons only |
| turmeric-500 on white | 2.4 : 1 | ❌ Never for text |
| sage-700 on cotton-50 | 6.1 : 1 | All text |
| muted `#5b6472` on cotton-50 | 5.8 : 1 | Secondary text |
| slate-400 on white | 2.6 : 1 | ❌ Never for text (used today for review dates; fix in Phase 2) |

The storefront stays light (ivory cotton is the brand). The admin panel gets a dark mode.

## Typography

| Use | Font | Notes |
|---|---|---|
| Display / headings | **Fraunces** (already used) | Soft, editorial serif that suits handcraft. Weights 400 / 600 / 700. |
| Body / UI | **Inter** (already used) | Highly legible on small Android screens. 400 / 500 / 600 / 700. |
| Hindi (Devanagari) | **Mukta** | For Hindi keywords, search and a future Hindi version; pairs well with Inter. |

All three load through **`next/font`** (self-hosted, no layout shift, no request to Google). This fixes the remaining lint warning and L2.

**Type scale (mobile → desktop):** display 32→48, h1 28→36, h2 22→28, h3 18→20, body 15→16, small 13, micro 11 (badges only). Line-height 1.6 for body, 1.15 for display. Maximum line length 70 characters for reading text.

## Space, shape, depth

- **Spacing:** 4-px base (Tailwind default). Section padding 48 px mobile / 96 px desktop. Generous white space is part of the "premium" feel.
- **Radius:** cards `0.875rem` (existing `--radius-card`), buttons and inputs `0.625rem`, chips fully rounded.
- **Shadow:** almost none. Depth comes from cotton-on-white layering and hairline borders, like paper and fabric.
- **Motif:** one hand-drawn SVG buti (small floral) and one border strip, used for section dividers, empty states and the loading indicator, at 8–15 % opacity. Never placed over product photos.

## Motion

- 150 ms for hovers and presses, 250 ms for drawers and modals, `ease-out`.
- Product cards: second photo cross-fades on hover (desktop only).
- Add-to-bag: the bag icon gives a small bounce and the count ticks up.
- Everything respects `prefers-reduced-motion` (motion off, instant states).

## Photography rules (for the owner and photographer)

- **Product grid:** 4:5 portrait, same light ivory background, model or flat-lay, minimum 1600 px tall.
- **Every product:** front, back, detail close-up of the block print (shows the hand-made texture), fabric fall / drape, and for bedsheets the full-bed shot plus a pillow cover close-up.
- **Colour accuracy:** daylight or a calibrated light. The handmade-variation disclaimer covers small differences, but not wrong colours.
- **Alt text pattern:** "{Colour} {print style} hand-block print {fabric} {product type} — {view}", e.g. "Indigo Sanganeri hand-block print mulmul saree — pallu close-up".

## Components (built in Phase 2)

Buttons (primary indigo, accent madder, outline, ghost, icon) · inputs, selects, OTP input, pincode input with autofill · chips and filter pills · **product card** (photo, wishlist heart, title, price block, rating, badges) · **price block** (price, MRP struck through, % off, "incl. of all taxes", wholesale price + MOQ for approved buyers) · badges (Hand-block, Screen print, New, Bestseller, Low stock, Wholesale) · size and colour selectors (swatches with real fabric thumbnails) · size-chart modal · pincode checker · quantity stepper · drawers (mobile filters, cart) · modals · toasts · skeleton loaders · empty and error states (with the buti motif) · order timeline / tracking stepper · data tables, drag-sortable lists, image uploader, rich-text editor (admin).

## Mobile-first patterns

- Designed at **360 px wide** first. Most of your shoppers are on Android phones.
- Sticky **Add to bag / Buy now** bar on the product page, within thumb reach.
- **Bottom navigation** on mobile: Home · Categories · Search · Wishlist · Account.
- Filters in a full-height bottom drawer with an "Apply (24 items)" button.
- Tap targets of at least 44 × 44 px.
- Performance budget: under 170 KB of JavaScript on storefront pages; hero image preloaded; LCP under 2.5 s on 4G.

## Accessibility

WCAG 2.2 AA: contrast as above, visible focus ring (already present), full keyboard support, form errors announced, every image has alt text, every icon button has a label, and the language is set (`en-IN`, and `hi` on Hindi strings).
