# GoServe — Design Tokens (extracted from the investor deck)

**Source:** `Go Serve Deck.pdf` (20 pages, 1440 x 810, 16:9).
**Date extracted:** 11 Oct 2026.
**Method:** we rendered all 20 pages, then read every colour twice: once from the PDF vector layer (fills, strokes, text) and once from the rendered pixels. A colour only enters this palette if it appears in the deck, not if it is a guess.

The goal is simple: the product should look like it was made from the deck. Same cream, same deep green, same lime. If a colour is not here, we do not use it.

---

## 1. The brand palette (the eight that matter)

These are the colours the deck leans on. Everything in the product is built from them.

| Name | Hex | RGB | HSL | Where it appears in the deck |
|---|---|---|---|---|
| **Cream** | `#E4E6D9` | 228, 230, 217 | 69, 6%, 90% | The main background on almost every page (52-90% of pixels). This is the deck's signature colour. |
| **Deep Green** | `#45654E` | 69, 101, 78 | 137, 32%, 40% | The primary brand green. Headers, buttons, strong shapes, footers. |
| **Ink Green** | `#263528` | 38, 53, 40 | 128, 28%, 21% | The main text colour. Headings and body in the deck. |
| **Sage** | `#BFCFB4` | 191, 207, 180 | 96, 13%, 81% | The full-page background on the first and last cover pages. A softer green surface. |
| **Off White** | `#F7F3EF` | 247, 243, 239 | 30, 3%, 97% | Warm white panels and cards. Used on pages with white space. |
| **Lime** | `#C8D888` | 200, 216, 136 | 72, 37%, 85% | The light lime/yellow-green accent found on the cover pages. |
| **Lime Soft** | `#CFD998` | 207, 217, 152 | 69, 30%, 85% | A lighter tint of the lime, paired with Lime on the covers. |
| **Warm Yellow** | `#FFDE59` | 255, 222, 89 | 48, 65%, 100% | A bright warm yellow used as a highlight (page 12). The deck's one true pop accent. |

Black (`#000000`) and White (`#FFFFFF`) also appear, but only as plain ink and paper. They are not brand colours.

---

## 2. Supporting colours (secondary and earthy)

The deck also uses olive and warm earth tones. These support the brand. Use them for charts, tags, and food imagery, not for primary actions.

| Name | Hex | RGB | HSL | Use |
|---|---|---|---|---|
| **Olive** | `#7F9743` | 127, 151, 67 | 77, 56%, 59% | Deeper lime. Secondary accent. |
| **Olive Soft** | `#889848` | 136, 152, 72 | 72, 53%, 60% | The olive in the covers, one step lighter. |
| **Muted Gray** | `#706F70` | 112, 111, 112 | 300, 1%, 44% | Neutral gray for secondary text and UI chrome. |
| **Earth Deep** | `#654E3A` | 101, 78, 58 | 28, 43%, 40% | Warm brown. Earthy sections and food imagery. |
| **Earth Mid** | `#966E3A` | 150, 110, 58 | 34, 61%, 59% | Warm tan. Tags and dividers. |
| **Earth Light** | `#C17D46` | 193, 125, 70 | 27, 64%, 76% | Warm orange-tan. Highlights on food pages. |

The warm tones come mostly from food photography (pages 14, 15, 20 show oranges, browns, and golds). They are not the brand, but they belong to the deck's food mood, so we keep them as a secondary family.

---

## 3. Colour frequency (so we use them in the right proportion)

Extracted from the rendered pixels of all 20 pages.

| Colour | Share of pixels | Meaning for us |
|---|---|---|
| `#E4E6D9` Cream | ~52% | Background must dominate. The product should feel calm and paper-like. |
| `#FFFFFF` White | ~17% | Cards and clean panels. |
| `#BFCFB4` Sage | ~6% | Section backgrounds and cover-style blocks. |
| `#F7F3EF` Off White | ~2% | Warm panels. |
| `#45654E` Deep Green | ~1% | Primary actions and structure, used with restraint. |
| Warm earth tones | ~2% | Food and imagery only. |
| Lime and Yellow | <1% | True accents. Small pops only. |

The lesson: background first, green second, accents last. Never flood the screen with green or yellow.

---

## 4. Material Design 3 role mapping

We use Material Design 3. This is how the deck colours map to M3 roles. Light theme.

| M3 role | Hex | Name |
|---|---|---|
| `primary` | `#45654E` | Deep Green |
| `on-primary` | `#FFFFFF` | White |
| `primary-container` | `#BFCFB4` | Sage |
| `on-primary-container` | `#263528` | Ink Green |
| `secondary` | `#7F9743` | Olive |
| `on-secondary` | `#FFFFFF` | White |
| `secondary-container` | `#C8D888` | Lime |
| `on-secondary-container` | `#263528` | Ink Green |
| `tertiary` | `#FFDE59` | Warm Yellow |
| `on-tertiary` | `#263528` | Ink Green |
| `tertiary-container` | `#CFD998` | Lime Soft |
| `on-tertiary-container` | `#263528` | Ink Green |
| `background` | `#E4E6D9` | Cream |
| `on-background` | `#263528` | Ink Green |
| `surface` | `#F7F3EF` | Off White |
| `on-surface` | `#263528` | Ink Green |
| `surface-variant` | `#BFCFB4` | Sage |
| `on-surface-variant` | `#45654E` | Deep Green |
| `outline` | `#45654E` | Deep Green |
| `outline-variant` | `#BFCFB4` | Sage |
| `error` | `#B3261E` | Standard M3 red (added by us, the deck has none) |
| `on-error` | `#FFFFFF` | White |

Note: the deck has no error colour. Orders, payments, and failures still need one, so we use the Material 3 standard red. This is the only colour we add that is not from the deck.

---

## 5. CSS variables (drop-in)

```css
:root {
  /* brand core */
  --gs-cream:        #E4E6D9;
  --gs-deep-green:   #45654E;
  --gs-ink-green:    #263528;
  --gs-sage:         #BFCFB4;
  --gs-off-white:    #F7F3EF;
  --gs-lime:         #C8D888;
  --gs-lime-soft:    #CFD998;
  --gs-warm-yellow:  #FFDE59;

  /* supporting */
  --gs-olive:        #7F9743;
  --gs-olive-soft:   #889848;
  --gs-gray:         #706F70;
  --gs-earth-deep:   #654E3A;
  --gs-earth-mid:    #966E3A;
  --gs-earth-light:  #C17D46;

  /* material 3 roles */
  --md-primary:                 var(--gs-deep-green);
  --md-on-primary:              #FFFFFF;
  --md-primary-container:       var(--gs-sage);
  --md-on-primary-container:    var(--gs-ink-green);
  --md-secondary:               var(--gs-olive);
  --md-secondary-container:     var(--gs-lime);
  --md-tertiary:                var(--gs-warm-yellow);
  --md-background:              var(--gs-cream);
  --md-on-background:           var(--gs-ink-green);
  --md-surface:                 var(--gs-off-white);
  --md-on-surface:              var(--gs-ink-green);
  --md-surface-variant:         var(--gs-sage);
  --md-outline:                 var(--gs-deep-green);
  --md-error:                   #B3261E;

  /* typography */
  --gs-font: "Roboto", system-ui, sans-serif;

  /* spacing and shape */
  --gs-space-1: 4px;
  --gs-space-2: 8px;
  --gs-space-3: 16px;
  --gs-space-4: 24px;
  --gs-radius-s: 4px;
  --gs-radius-m: 8px;
  --gs-radius-l: 12px;
}
```

---

## 6. Usage rules

1. Background is cream (`#E4E6D9`). Full stop. This is what makes it look like the deck.
2. Text is ink green (`#263528`), never pure black, except tiny legal text.
3. Deep green (`#45654E`) is for primary actions, headers, and structure. Use it with restraint.
4. Sage (`#BFCFB4`) is for section backgrounds and the cover-style hero blocks.
5. Lime and warm yellow are small pops only: a badge, a highlight, a chart series. Never a large fill.
6. No hardcoded hex in code. Always use the token.
7. Never invent a colour. If it is not in this file, it is not in the product.

### Status colours (order tracking)

Order status needs its own colours. We build them from the palette so they still feel like the deck.

| Status | Colour | Hex |
|---|---|---|
| Placed | Muted Gray | `#706F70` |
| Accepted | Olive | `#7F9743` |
| Cooking | Warm Yellow | `#FFDE59` |
| Ready | Lime | `#C8D888` |
| Out for delivery | Earth Mid | `#966E3A` |
| Delivered | Deep Green | `#45654E` |
| Failed / late | Standard red | `#B3261E` |

---

## 7. What is NOT brand

Do not put these in the product. They came from photos, mockups, or the environment.

- Food photo oranges and deep browns (`#914200`, `#974900`, `#4E3925`). These are the roast, not the brand. Use the Earth tones instead if a warm accent is needed.
- Screenshot grays (`#B4B4B4`, `#A6A6A6`, `#BDBABB`) from a device mockup on page 12.
- Near-black backgrounds (`#0F1015`) from image shadow.

---

## 8. Preview

Two preview files sit next to this document in `docs/assets/`:

- `palette.html` — open in a browser to see every swatch, the M3 mapping, and status colours.
- `palette.png` — a flat image of the palette, for quick reference.

If either preview and the product ever disagree, this document wins.

---

## 9. Diagrams

Architecture pictures use only these colours. The theme file is `docs/architecture/diagrams/theme.json`. A gate script fails any picture that paints another colour.

| Meaning | Colour |
|---|---|
| Canvas | Cream `#E4E6D9` |
| Slot and lane frames | Off White `#F7F3EF`, Sage `#BFCFB4` border |
| Text and arrows | Ink Green `#263528`, Deep Green `#45654E` |
| Box that is the same as before | White `#FFFFFF`, Deep Green border |
| Box that is new in this phase | Lime Soft `#CFD998`, thick Ink Green border |
| Box for later | Off White, dashed Muted Gray `#706F70` border |
| Arrow labels | Lime `#C8D888` |
| Decisions | Warm Yellow `#FFDE59` |
| Archive slot | Earth Mid `#966E3A` border |
| Learning loop slot | Olive `#7F9743` border |
| Order status steps | The status colours in section 6 |

