# Laya first, Jev at zero: what is ready and what is not (story #253)

**Date:** 25 Oct 2026. Written before any code, as the radar and phase gate ask. Sources are our own files (Tier S) and the Laya page (Tier A, the author's claims).

## What the story asks

Laya answers the decisions D1 to D5 on our own server for free. Jev stays only as a fallback, capped at 0 calls a day. An eval per decision picks where Laya may go live.

## What exists today

| Piece | State | Source |
|---|---|---|
| Decision engine switch | Live. Prod engine is **Rules**. Jev is off, so Jev cost is already 0. | #263, prod read on 25 Oct |
| D1 (which rider) | Decided by code (nearest first, batch behind a switch). No model picks it. | #272, #273 |
| Our tuned Laya | A **text classifier** for 7 questions on support notes and order notes (topic, mood, needs_human, allergy, special request, refund, at_risk). Best run: macro accuracy 0.902, macro ECE 0.053 (target 0.05, not met); needs_human recall 0.513 against a 0.90 target. | experiments E2, E3 |
| Laya trained for D1 to D5 | **None.** No order data, no labels for rider or cook-order choices. | `ops/ai/laya`, `docs/ai/LAYA_PLAN.md` |
| Golden dataset for D1 to D5 | **None** in `docs/ai`. | grep, 25 Oct |
| Laya on the Oracle box | **Not served.** The model sits in a Kaggle kernel output; the push to a private HF repo (F104) waits for E3 to pass. | follow-ups F104 |
| Speed on our ARM CPU | **Not measured.** The author says 193 to 464 ms on a CPU. | `laya-2026-10.md` row 6 |
| Laya call in SUB 13 | Not built (F172). The engine row says `laya_not_deployed`. | `decide_result.js` |

## What this means

- **"Jev capped at zero" is already true** on prod because the engine is Rules. What is missing is a second lock (a cap parameter, so a mistaken switch to Jev cannot spend) and the health page lines (Laya calls, Jev calls, cost).
- **"Laya first for D1 to D5" cannot be honest yet.** Laya has never seen a D1 to D5 decision. The Laya plan itself says D1 and D3 are rules picking five and Laya picking one, and D2 and D5 are plain code. Training Laya on the rules' own picks would only copy the rules.
- **Serving Laya** needs three things we do not have: the model on a private repo (E3 passes first), an ARM build and speed measurement on the Oracle box (the owner's server), and an eval set.

## Options (the owner decides)

1. **Lock Jev at zero now (small, real).** A `jev_daily_cap` parameter in the params store, default 0, checked in SUB 13 before any Jev call; the health page and the daily card show Laya calls (0), Jev calls (0) and cost (0). No Laya server. Honest title: "Jev capped at zero".
2. **Option 1, plus a measured Laya on the box.** Push the E3 model (needs the owner's go on F104), run `laya-serve` on the Oracle box, measure speed on ARM CPU, wire a quiet test (Laya answers, rules decide). About one to two days, needs the owner's server access.
3. **Wait.** Keep Rules. Revisit when real orders give D1 labels.

Recommendation: option 1 now. Option 2 after the 2 Nov launch, when there are real decisions to learn from.
