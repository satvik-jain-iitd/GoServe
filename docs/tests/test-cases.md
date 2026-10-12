# Test cases

Every test, with its story and scenario. Story #16 = architecture evolution page.

| Test | Story | Scenario | Kind | File | Result |
|---|---|---|---|---|---|
| Diagram gate: crossings, arrows through boxes, backward arrows, labels, overlaps, text outside boxes, colours, font, PNG size | #16 | S1 | Automatic | `~/.claude/skills/diagram-standards/render.mjs`, report `docs/architecture/diagrams/gate-report.json` | Pass (7 of 7) |
| Gate catches a bad draft (red first) | #16 | S1 | Automatic | naive draft (in the PR) | Fails as expected: 1 backward arrow, 3 unlabelled arrows, 1 colour outside the palette |
| Gate counts crossings right (K3,3 graph, 2 layers = 9) | #16 | S1 | Automatic | sanity check (in the PR) | 9 crossings reported |
| Phase pictures keep the same slots, rows and order | #16 | S2 | Automatic | `--compare` in the gate | Pass |
| Components list keeps every first row, has MVP0–MVP4 columns, evidence tags, procurement tables | #16 | S3 | Manual review | `docs/ARCHITECTURE_COMPONENTS.md` | Pass |
| MVP0 spec, PRD, solution doc and ADR-004 name the same MVP 0 back end | #16 | S4 | Manual review | those files | Pass |
| Home, pre-register and footer name Delhi as the first city | #18 | S1 | End-to-end | `site/tests/e2e/site.spec.ts` (first city) | Pass |
| No page says Kota | #18 | S1 | End-to-end | `site/tests/e2e/site.spec.ts` (first city) | Pass |
| palette.ts, tokens.css and the diagram theme match design/tokens.json | #18 | S2 | Unit | `site/tests/unit/tokens.test.ts` | Pass |
| Components file has no "Prompt for Claude" and keeps every first row (138 → 145 table lines) | #20 | S1 | Automatic (grep) | `docs/ARCHITECTURE_COMPONENTS.md` | Pass |
| Every non-owned part has researched options with tier, confidence and a recommendation | #20 | S2 | Manual review | `docs/research/options-*-2026-10.md` | Pass |
| MVP 0 readiness table marks each dependency | #20 | S3 | Manual review | `docs/architecture/mvp0-build-design.md` | Pass |
