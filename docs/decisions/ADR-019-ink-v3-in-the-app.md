# ADR-019: GoServe Ink v3 in the app

## Status

Accepted 24 Oct 2026 (owner approved the J2 boards screen by screen; reviewer's plan, section E18).

## Date

2026-10-24.

## Context

The app looked like a Material app in Roboto. The owner asked for a Steve Jobs bar: one job per screen, taste, real photos. The reviewer designed GoServe Ink v3 on Claude Design (J1, J2) and the owner approved 41 boards.

## Decision

1. The look is **GoServe Ink v3**: the original palette, a Night that changes only paper and ink, Bricolage Grotesque for display, Anek Latin and Anek Devanagari for text, DM Mono for numbers, 6 px corners, hairline rules, pill primary button.
2. **One source.** `design/tokens.json` has an `ink` block (Day and Night colours). `app/src/styles/tokens.css` must carry exactly those; a unit test compares them. `app/src/ui/ui.css` is the approved component sheet from the boards, with the same class names as before, so a screen moves to Ink by markup, not by a new design system.
3. **Day and Night by the clock**: Night 18:00 to 06:00, or a pin from You > Look, kept in this browser. `index.html` sets `data-theme` before the first paint; `src/lib/theme.ts` is the tested copy. Sunset and Night Blue were mockups and are not in the app. **Amended 24 Oct 2026 (#225, owner on a real phone: "default mode Day rakho abhi"): Day is the default at any hour; the clock no longer picks Night; Night stays a pin on You > Look. The "By the clock" chip is gone.**
4. **Fonts are self-hosted** (Latin subsets, `app/public/fonts`), preloaded and cached by the service worker. Roboto is removed.
5. **Rollout in layers**, each under the 50-file cap and each with the same test ids: H10a foundation, H10b home, menu, dish, H10c bill, placed, tracker, delivered, H10d orders, account and the states. Rider, kitchen and admin follow in H11 and H12.

## Consequences

Old screens keep working on the new sheet while they are rebuilt; a few legacy variables stay in `tokens.css` until H10d. The Roboto test and the old spacing and colour rules of `ui.test.ts` were rewritten for the new sheet.
