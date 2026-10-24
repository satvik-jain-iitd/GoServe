# Repo radar (append only)

## 2026-10-25 · need: mobile admin screens for a small food-delivery ops team (list kitchens and riders, one kitchen with staff and menu, add-kitchen form), React PWA on the Ink design system

Runs: `scout.py --need "mobile admin screens for a small food delivery ops team ..." --limit 8` → no repos found; `scout.py --need "react mobile admin list detail form screens" --limit 6` → no repos found (logs: scratchpad `radar-h12b.log`). GitHub `topic:admin-dashboard topic:react` by stars, top 3 READMEs read.

| Repo | Tier | What it is | Fit for this need | Verdict |
|---|---|---|---|---|
| marmelab/react-admin (★27k, active 24 Oct) | A for the counts | A frontend framework on REST/GraphQL with Material UI, react-hook-form and react-router; its own data provider and look. | Would replace the Ink screens and the Supabase reads with its own layer; ADR-019 fixes one look and one codebase. | Skip (score n/a, confidence 0.6) |
| appsmithorg/appsmith (★41k) | A for the counts | A hosted or self-hosted low-code platform for internal tools (Docker, Kubernetes). | A separate app, not a library in the PWA; the admin must live in the same installable app as the other roles. | Skip |
| dingyi214/slash-admin (★3k) | A for the counts | A React 19 + Vite + shadcn/ui dashboard template. | A template with its own components and theme; borrowing a template beats nothing we lack (lists, rows, forms exist in `app/src/ui`). | Skip |

Decision: build H12b from the house `ui/` components (rows, slip, tabs, StaffLanding). Nothing found calls into the Ink system; the screens are three lists and one form. Confidence 0.6 (keyword fit only; the 20-repo calibration is not done).

## 2026-10-25 · need: cash hand-over reconciliation between a delivery rider and a kitchen, business day bound to a closing time past midnight, Supabase (story #229)

Runs: `scout.py --need "cash hand-over reconciliation between delivery rider and kitchen, business day bound to closing time past midnight, Supabase"` → no repos found; GitHub `topic:cash-reconciliation`, `topic:delivery-management topic:supabase`, `cash settlement rider delivery in:readme stars:>50`.

| Repo | Tier | What it is | Fit for this need | Verdict |
|---|---|---|---|---|
| wityliti/witylogix (★5, pushed Aug 2026, no licence) | C | A self-hostable delivery platform with order sync, CRM and fleet engines. | A whole platform in another stack; no cash-day or hand-over rule in its README. | Skip |
| sahol3/scarpar (★7, MIT, pushed Jul 2026) | C | Next.js 15 + Supabase commerce platform with cash-on-delivery "settlement batches". | The idea matches (a settlement batch = our hand-over), the code is a multi-tenant platform; borrow the idea only. | Borrow the idea: stamp the orders, not a ledger |
| accord-erp-automation/accord_mobile (★10, pushed Jun 2026) | C | Flutter client for ERPNext delivery and warehouse. | Flutter, ERPNext; nothing on cash days. | Skip |

Decision: build in the app. Two small functions (`dayOf`, `cashInHand`) shared by both screens, one column `orders.cash_handed_at` and one rpc `kitchen_handover`; the "settlement batch" idea from scarpar became a stamp per order, which is less code and gives both screens one source. Confidence 0.7 (the topic search found no library for a cash day or hand-over; the four reconciliation repos were bank or ERP tools, ★0).
