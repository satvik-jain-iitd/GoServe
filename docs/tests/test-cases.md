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
| Full ops research saved with tiers and sources (both parts) | #22 | S1 | Manual review | `docs/research/operations-tech-deep-2026-10.md` | Pass |
| ADR-006, ADR-007 and the components file match the MVP 0 Q&A | #22 | S2 | Manual review | those files | Pass |
| CLAUDE.md and PLAN.md point to the phase gate | #22 | S3 | Automatic (grep "phase-gate") | `CLAUDE.md`, `docs/PLAN.md` | Pass |
| Manifest is installable: name, standalone, start url | #39 | S1 | Unit | `app/tests/unit/manifest.test.ts` | Pass |
| Manifest has 192 and 512 icons on disk, token colours only | #39 | S1 | Unit | `app/tests/unit/manifest.test.ts` | Pass |
| App opens, links the manifest, registers a service worker | #39 | S1 | End-to-end | `app/tests/e2e/app.spec.ts` | Pass |
| App tokens.css has every core, supporting and status colour from tokens.json | #39 | S2 | Unit | `app/tests/unit/tokens.test.ts` | Pass |
| tokens.css has no colour outside tokens.json | #39 | S2 | Unit | `app/tests/unit/tokens.test.ts` | Pass |
| Manifest colours come from tokens.json; index.html theme-color matches; Apple touch icon linked | #39 | S1 | Unit | `app/tests/unit/manifest.test.ts` | Pass |
| App shell loads offline after the first visit | #39 | S1 | End-to-end | `app/tests/e2e/app.spec.ts` | Pass |

| Guard: clean file passes; secret, file over 500KB, merge marker, unclosed code block are blocked | #40 | S2 | Unit | `scripts/test_guard.py` | Pass |
| Guard: Conventional Commit subjects accepted, bad ones rejected; PR over 50 files rejected | #40 | S2 | Unit | `scripts/test_guard.py` | Pass |
| Every PR runs lint, type check, unit, e2e and build for app/ | #40 | S1 | CI | `.github/workflows/ci.yml` job `app` | Pending first PR run |
| Push to dev with `app/**` deploys to Vercel with the three repo secrets | #41 | S1 | Unit (workflow check) | `scripts/test_deploy_dev.py` | Partly: workflow check passes; URL row below is pending |
| Deploy paths contain `app/**` and never `site/` | #41 | S2 | Unit (workflow check) | `scripts/test_deploy_dev.py` | Pass |
| Dev URL returns 200 and the app is installable | #41 | S1 | Manual after first deploy | `goserve-app-dev` URL | Pending first deploy |
| App on main publishes to Pages project `goserve-app` with Cloudflare secrets, paths `app/**` and `design/tokens.json` | #42 | S1 | Unit (workflow check) | `scripts/test_deploy_app.py` | Pass |
| `deploy.yml` (project `goserve`) is unchanged and app deploy never watches `site/` | #42 | S2 | Unit (workflow check) | `scripts/test_deploy_app.py` | Pass |
| `goserve-app.pages.dev` returns 200 (today 522) | #42 | S1 | Manual after the first release PR to main | `goserve-app.pages.dev` | Pending first release |
