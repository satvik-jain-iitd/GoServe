# GoServe — MVP 0 Build Design

**Date:** 13 Oct 2026
**Status:** Design. Built in the next task. Due 18 Oct 2026.
**Decision record:** `docs/decisions/ADR-004-phased-architecture.md`.
**Picture:** `docs/architecture/evolution.md` (MVP 0).

---

## 1. Goal

The founder opens one app on his Android phone in front of an investor. He places an order. The kitchen screen gets it live. The order moves to delivered. The ops screen shows the AI suggestion and live numbers. Nothing on stage can break the story.

## 2. The 90-second demo script

1. Open the installed app. Pick "Customer".
2. Add 2 dishes. Place the order (pay later).
3. Switch to split view. The kitchen side gets a live alert.
4. Tap Accept, Start, Ready.
5. The ops side shows: "AI suggests rider R2 (81%). The rule agrees."
6. Rider steps play. The customer side shows "Delivered".
7. Open the metrics panel: time to the kitchen screen, decision time, runs today.

Solo demo: tap **Autopilot**. The kitchen and rider steps move by themselves.

## 3. Safety net (the pitch must not fail)

- **Autopilot on the phone.** If the network or the server fails, the phone plays the same story from local data. A banner says "Offline demo".
- **Own space per session.** Every row carries a `session_id`. Investors who open the link do not see each other's orders. A reset button clears the session. A second device joins the same session by a link (ADR-011).
- **Health check page.** Before the demo, one page checks Supabase, n8n and Jev.
- **A recorded video** as the last backup.

## 4. Where each part runs

| Part | Runs on | Note |
|---|---|---|
| PWA screens | Phone (Vercel for dev, Cloudflare Pages for production) | Stack in ADR-006 (accepted) |
| Front door | None (ADR-009) | The phone reads Supabase directly and writes through an n8n webhook that checks a demo token |
| Order logic | n8n on Oracle | MAIN and SUB workflows, rulebook B11 and B12 |
| Orders, events, logs | Supabase Postgres | New GoServe project. Never touch `sync.linkright.in` |
| Live updates | Supabase Realtime | No polling |
| AI suggestion | Jev via OpenRouter | Shown, not trusted. The rule decides |

## 5. Data (Supabase)

Every table has `kitchen_id` and `session_id`.

| Table | Holds |
|---|---|
| `kitchens` | One demo kitchen |
| `menu_items` | Dishes, prices, available flag |
| `orders` | One row per order. A unique order key comes from the phone, so a retry never makes two orders |
| `order_events` | One row per step, with time and who did it. Never edited |
| `decision_log` | Every decision, in the shape in `docs/ai/LAYA_PLAN.md` section 4 |
| `run_log` | Every workflow run: settings version, time taken, cost, errors |
| `params` | Tunable settings with a version number |

The database itself rejects an illegal step (for example, "delivered" before "ready").

## 6. n8n workflows (count fixed up front)

| Workflow | Job |
|---|---|
| `GS MAIN 01 Order API` | One trigger family: the phone's webhook calls. Config, kill switch, then calls the SUBs |
| `GS SUB 11 Place order` | Check items, write the order and its first event |
| `GS SUB 12 Change status` | Check the step is legal, write the event |
| `GS SUB 13 Decide` | Rule first, Jev second, write the decision row. Later, Laya joins here |
| `GS SUB 14 Write logs` | Write `run_log` rows |
| `GS MAIN 90 Daily scorecard` | Once a day: numbers to the owner on Telegram |

Five workflows plus one scheduled job. Propose, test and promote workflows come in MVP 1.

## 7. What the phone may do

- Show screens. Work out the cart total for speed. Cache the menu for offline use.
- Run the autopilot.
- Never decide a price, a rider, a payment or a final status. The server checks all of these again.

## 8. Done means

1. One link opens and installs on the founder's Android phone.
2. The full path works: menu, cart, bill, place order, kitchen, rider steps, delivered.
3. The order is really saved in Supabase.
4. The kitchen screen gets the order in under 2 seconds, without a refresh.
5. 20 of 20 scripted runs pass.
6. The autopilot works in airplane mode.
7. Every decision has a row in `decision_log`.
8. No secret is in the PWA.

## 9. Readiness (owner Q&A, 13 Oct 2026)

| Dependency | Status | Owner action |
|---|---|---|
| Cloudflare account and Pages | ✅ Ready. App project `goserve-app` → `goserve-app.pages.dev`, free, no card | None |
| Supabase projects (Mumbai) | ✅ Production `GoServe` (ref vpuumnslnionplrxmqlf) + dev `goserve-dev` (ref tmxyizmkpwwfyazvrfhw); URLs and keys in `02_databases.env` | None |
| Paused Supabase project (old account) | Not relevant — GoServe moved to a new Supabase account on klickbae8yt@gmail.com | None |
| n8n on Oracle | ✅ Ready. API key in the vault. Workflows are registered, not capped (rulebook A1 rule 3) | Say yes before any workflow is activated |
| Jev (OpenRouter) | ✅ Ready. GoServe-only key, hard cap $2 (checked) | Rotate the key later (it was pasted in chat) |
| Telegram alerts | ✅ Ready (@GoServeBot) | None |
| Menu | ✅ Claude makes a Delhi sample menu (8–10 dishes, free photos) | None |
| Logo and icon | ✅ In `design/brand/` | Send a vector logo if one exists |
| PWA stack | ✅ React + Vite + TypeScript + Capacitor (ADR-006); code in `app/`; no custom backend (ADR-007) | None |
| Cloudflare Pages project `goserve-app` | ✅ Created 13 Oct (classic Pages, account klickbae8yt@gmail.com) → **`goserve-app.pages.dev`** (live after the first deploy) | None |
| Uptime monitor | ✅ UptimeRobot free; n8n health monitor Up; app monitors added after the first deploy | None |
| Vercel dev project | ✅ `goserve-app-dev` with `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (dev) | Git link: deploy from GitHub Actions with `VERCEL_TOKEN`, or install the Vercel GitHub app on the repo |
| Test devices | ✅ Android emulation on the laptop + owner's iPhone + founder's Android for the final check | Share the link with the founder before the demo |
| Founder business steps | Not needed for MVP 0 | Start the checklist in `docs/product/founder-checklist.md` |

