# Go Serve — Jev Integration Plan

**Date:** 11 Oct 2026
**Plain English.** This is a plan, not code.

---

## 1. What Jev is, in one paragraph

Jev is a special AI model from a company called TypeSafe. It is not a chatbot. It does not write sentences.

You show it the state of your system (for example: "3 orders waiting, 2 riders free, nearest rider is 1.1 km away"). You also give it the list of choices it may pick from. It sends back **one choice, with a confidence score**, in about 100 to 500 milliseconds.

Because it can only pick from the choices we allow, it can never make up new answers. That is why it is safe to use inside our order system. It never sits in the payment path. Normal code always has the final word.

## 2. How we call it (OpenRouter only)

We do NOT connect to TypeSafe directly. We call Jev through **OpenRouter** (the same API that already holds our keys in `~/Desktop/Secrets/openrouter.env`).

Three Jev models are available there:

| Model on OpenRouter | What it does | When to use it |
|---|---|---|
| `typesafe/jev-router` | Picks the best Jev model and reasoning effort for each request. 1M context. | Default entry point. Use in production as the smart router. |
| `typesafe/jev-latest` | Always points to the newest Jev family model. | Experiments and testing new behaviour. |
| `typesafe/jev-1.13` | Pinned, stable model. Input $0.042 per million tokens, output free, 64K context. Takes a JSON form; a null question returns the probability that a condition holds. | The safe default for each individual decision when we want a fixed, known model. |

**Rule:** use `typesafe/jev-router` as the normal gateway. If we want a locked, reproducible answer for a specific decision, call `typesafe/jev-1.13` directly. Use `typesafe/jev-latest` only on our test setup, never in money paths.

## 3. The interface (the shape of each call)

One small wrapper inside our backend. Every decision goes through it. This is the only place in the code that talks to OpenRouter.

- **In:** the state of the system (plain JSON text) + the list of allowed choices.
- **Out:** the chosen decision + a probability (0 to 1) + the confidence level.
- **Frequency control:** our own code decides when to ask. Jev never triggers itself.
- **Timeout:** if Jev does not answer in time, we use the fallback rule (see section 6).

Later we can replace this wrapper's inside (our own tuned model) without changing the app, because the app only sees this one small interface.

## 4. The decision catalogue

Ten decisions. For each one we wrote: what it is, the input, the allowed choices, the fallback, the minimum confidence to accept, and where it runs.

| # | Decision | Input (state) | Allowed choices | Fallback | Min confidence | Where it runs |
|---|---|---|---|---|---|---|
| D1 | Assign rider | Orders waiting, rider positions, rider loads, kitchen ready time | Nearest free rider / least-loaded rider / keep waiting | Round-robin among free riders | 0.7 | Dispatch on order ready |
| D2 | Delivery ETA | Kitchen, rider GPS, distance, traffic hints | Fast / normal / slow estimate | Distance ÷ speed table | 0.65 | Live tracking |
| D3 | Next order to cook | Queue of orders, prep times, SLA, station load | Order A / B / C | First-in-first-out | 0.7 | Kitchen screen |
| D4 | Late-order risk | Age of order, prep state, rider state, SLA | At risk / on track | Rule: age > 60% of SLA = at risk | 0.6 | Every status change |
| D5 | Zone/service check | Address, kitchen zone shape | Inside / outside | Point-in-polygon rule | 0.85 | Checkout |
| D6 | Abuse/refund flag | Order history, refunds, device, payment | Normal / review / block | Threshold rules (e.g., 3+ refunds) | 0.75 | After payment, before dispatch |
| D7 | Offer choice | Customer, cart, repeat pattern | Offer A / B / none | Simple margin rule | 0.6 | Cart |
| D8 | Reorder nudge | Past orders, frequency, time of day | Nudge / skip | Frequency rule | 0.55 | Home screen (later) |
| D9 | Support triage | Customer message, order state | Refund / retry / escalate | Keyword rules | 0.7 | Support inbox (later) |
| D10 | Copilot routing | Founder question, available reports | Route to report A / B / human | Keyword match | 0.7 | Founder copilot (MVP 3) |

**Day 1 (MVP 1):** D1, D2, D3, D4, D5.
**Later (MVP 2):** D6, D7. **MVP 3:** D8, D9, D10.

## 5. Guardrails (the hard rules)

1. Jev never processes payments. Money logic stays in normal code with idempotency (unique order ID, charge once).
2. Every Jev answer with confidence below its threshold is ignored and the fallback rule is used.
3. We log every Jev answer (inputs, choice, confidence, time). This log is our future training data and audit trail.
4. If OpenRouter is down or slow, fallback rules run automatically. The kitchen keeps working.
5. We never send customer personal data to Jev beyond what the decision needs (no passwords, no full card details, ever).
6. The wrapper is the only code that calls OpenRouter. Everything else uses the wrapper.

## 6. Fallback rules (used when Jev is low-confidence or unavailable)

- D1: assign the free rider who has delivered the fewest trips today.
- D2: ETA = distance (km) × 1.5 minutes if no traffic, × 2.5 if peak.
- D3: oldest order first (FIFO).
- D4: age greater than 60% of SLA ⇒ mark "at risk".
- D5: point-in-polygon with the kitchen's saved zone shape.
- D6: block after 3 refunds in 30 days, or unmatching payment name.
- D7: none (no offer).
- D8: skip.
- D9: escalate to a human.
- D10: show the orders report.

## 7. Cost for Year 1 (estimate)

Assumption: 5,000 orders/day, 4 Jev decisions per order ≈ 20,000 calls/day, about 400 input tokens each.

- Input: 8 million tokens/day × $0.042/M ≈ **$0.34/day** ≈ **$10/month**.
- Output: free.
- Router overhead: small, inside the same number.
- Total visible AI cost: roughly **$10 to $20 per month**. This sits inside OpenRouter credits and the free LLM pool.

If the real numbers differ (fewer decisions, smaller state), cost goes down.

## 8. How we later swap Jev for our own model

When we have real operating data, we train a small decision model on our own logs (the Jev call history from section 5). The swap has three steps, all inside the wrapper:

1. Train the new model on the logged inputs and accepted decisions.
2. Run it in shadow mode beside Jev (both answer, only Jev's answer is used) until accuracy matches.
3. Flip a flag in the wrapper. The app does not change.

We can host the new model on the Oracle box (Ollama has gemma3, qwen2.5, phi4-mini) or move it where it fits.

## 9. What we will NOT do

- No Jev-managed money.
- No free-form Jev chat in the demo PWA.
- No calling Jev from the browser directly (always through our backend).
- No betting the order flow on a single vendor.