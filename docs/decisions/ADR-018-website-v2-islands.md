# ADR-018: Website v2 on Astro with React islands

## Status

Accepted 24 Oct 2026 (reviewer plan, section J3; owner approved the canvas).

## Date

2026-10-24.

## Context

The investor site at letsdwelo.in had seven pages in the v1 look. The design for v2 has three pages (Home, For investors, Pre-register) in the Ink v3 look, with small moves: words rising in, numbers counting up, a drifting product row, a light that follows the pointer.

## Decision

1. Keep Astro. The site stays static HTML and CSS.
2. The real registry blocks, not look-alikes (owner, rule 14). Motion Primitives (Text Effect, Animated Number, In View, Tilt, Spotlight, Infinite Slider, Scroll Progress) are copied with their own file names into `site/src/components/motion/`. Watermelon UI (navigation-3, footer-3, card, input, textarea, button, badge, popover) is installed with `shadcn add` into `site/src/components/ui/`. Small adapters in `site/src/islands/` give them GoServe props and add the reduced-motion rule. The registry files are kept as published, with four edits: `cn` is imported from `@/lib/utils`, the footer headings are `h3` (heading order), footer-3 takes a `credit` line, and navigation-3 is trimmed to GoServe's three links. `button`, `badge` and `popover` are the plain shadcn versions that the Watermelon blocks depend on, not Watermelon copies. `astro check` skips these two vendored folders.
3. Tailwind 4 is installed with the theme and utilities layers only. No reset: the Ink sheets (`ink.css`, `site.css`, ported from the canvas) own the base styles. `ink.css` replaces `tokens.css`.
4. Every island renders plain, final markup on the server and under `prefers-reduced-motion`. Motion only adds a rise or a count after the page loads. Headings keep the same markup in both states so the first paint is the real text.
5. The two forms keep their n8n webhooks. The pin code rides inside `city`, because the workflows keep only today's fields.
6. The v1 pages `/how-it-works`, `/technology`, `/roadmap` and `/palette` redirect to the new pages.

## Consequences

About 135 kB (gzip) of React and motion is loaded on pages with islands. Tailwind's reset is not loaded, so the base layer sets `box-sizing: border-box` (the footer block is `w-full` with padding). Fonts are self-hosted (Latin subsets) and preloaded, so the page does not shift when they load. Lighthouse mobile on a busy laptop: Home about 90, Investors 98, Pre-register 99, layout shift 0. Haikei SVGs and the pilot kitchen's own photos replace the labelled placeholders later (F128, F129).
