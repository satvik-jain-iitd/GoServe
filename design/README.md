# GoServe design language

**Plain English.** This folder is the home of how GoServe looks. Every screen, page,
diagram or slide we build reuses it. Nothing here may be lost, so it lives in Git.

## The one source of truth

`design/tokens.json` holds every colour, the Material Design 3 roles, the font, the
spacing scale and the corner sizes. If a value changes, change it here first.

These copies must match it. A unit test checks the colours (`site/tests/unit/tokens.test.ts`):

| Where | What it is |
|---|---|
| `site/src/styles/tokens.css` | CSS variables for the site (and the PWA later) |
| `site/src/data/palette.ts` | The palette for the `/palette` page and contrast tests |
| `docs/architecture/diagrams/theme.json` | Colours allowed in architecture diagrams |

## The rules and the story behind them

- `docs/design-tokens.md` — where each colour came from (the investor deck), how it was
  measured, usage rules, status colours, and the colour meaning in diagrams.
- `docs/assets/palette.html` and `docs/assets/palette.png` — a visual sheet of the palette.
- Live palette page: `/palette` on the site.

## The source deck

The investor deck (`Go Serve Deck.pdf`, 37 MB) is the origin of the palette. It is too big
for Git (files over 500 KB are blocked), so it stays in `knowledge/client_docs/`
(not in Git). Everything we took from it is written down in `docs/design-tokens.md`.

## How to use it in new work

1. Start from `design/tokens.json`. Use the token name, never a raw hex in product code.
2. Background cream, text ink green, deep green for actions, lime and yellow as small pops.
3. New screens follow Material Design 3 roles (`m3` in the JSON).
4. Diagrams use `docs/architecture/diagrams/theme.json` and the diagram gate.
5. If you need a colour that is not here, stop and ask. Never invent one.
