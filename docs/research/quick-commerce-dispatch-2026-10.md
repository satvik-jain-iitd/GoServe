# Quick commerce dispatch, ETA and live tracking: how the big apps do it

**Date:** 25 Oct 2026.
**Question:** How do Swiggy, Zomato, Blinkit, Zepto, Instamart, DoorDash, Uber Eats, Uber, Lyft, Grab, Instacart and Gopuff route orders, pick riders and show live tracking? Which methods should a small team copy first for the fastest delivery?
**Decision it changes:** The first algorithm in the "Rules" decision engine (story #263 and the next dispatch story). What the customer tracking screen shows.

**Where we stand today:** One real kitchen. A synthetic city of 10 kitchens and 20 riders. Riders ping location every 30 s. Dispatch picks, per order, the online rider nearest the kitchen with the fewest trips today (`dispatch_candidates`, `assign_rider` in `app/supabase/migrations/0018_dispatch.sql` and `0028_synthetic_city.sql`). No maps API yet.

**How this was read.** Tiers follow the owner's web-research rules: **A** = the company's own engineering blog, talk, paper or official page. **B** = big real data from a seller. **C** = blogs, vendor articles, guides. **P** = a named person's first-hand account with evidence. Confidence runs 0 to 1. Notes on gaps:
- The DoorDash engineering blog and Swiggy Bytes (Medium) refused direct fetch (HTTP 403 or timeout) on 25 Oct 2026. Their rows rest on search snippets of the original pages. Confidence is lowered by about 0.1 for that.
- No Zomato, Blinkit or Zepto engineering post on dispatch was found. Their rows are journalism or founder quotes.
- No Tier A or B study was found that measures how much live tracking cuts cancellations or support tickets. Only vendor numbers exist.

---

## 1. Findings table

### 1a. Dispatch and assignment

| # | Claim | Evidence (source, date) | Tier | Conf. | Who gains if we believe it | What it changes for GoServe |
|---|---|---|---|---|---|---|
| D1 | Big platforms do not assign one order at a time. They collect open orders and free riders for a short window, then solve them together. | Lyft paper: "Every few seconds, Lyft uses batch matching" (arXiv 2310.13810, Oct 2023). Uber job posts: "hundreds of thousands of possibilities considered every few seconds" (Uber careers, 2025-26). Swiggy: city-scale assignment "scoring every order-and-rider pairing" within a one-minute SLA (Akka customer story, undated, about 2024-25). | A (Lyft, Uber), C (Akka vendor story about Swiggy) | 0.85 | Lyft and Uber gain hiring and status. Akka sells the runtime. | Move from per-order greedy to a short batch window. Window length is ours to test. |
| D2 | Batching beats greedy because greedy can grab the nearest rider for order 1 and leave order 2 with a far rider. Lyft's worked example shows about 50% more total wait with greedy. | Lyft paper (arXiv 2310.13810, 2023). Lyft blog "Solving Dispatch in a Ridesharing Problem Space" (eng.lyft.com, about 2021): Hungarian solves it exactly; commercial solvers are faster in practice; edge weights are recomputed every cycle. | A | 0.8 | Lyft. The 50% is a toy example, not a field number. | The gain grows with how many orders overlap in time. At 1 kitchen it is near zero. At 10 kitchens at lunch it may matter. Test it in the sim. |
| D3 | The matching math is standard: bipartite min-weight matching (Hungarian) or a mixed-integer program. DoorDash scores every possible offer, then solves a MIP with Gurobi. | DoorDash "Next-Generation Optimization for Dasher Dispatch" (Holly Jin, 28 Feb 2020) and "Using ML and Optimization to Solve DoorDash's Dispatch Problem" (Aug 2021), via quoted snippets. FoodMatch paper: min-weight perfect matching on a bipartite graph, batching as graph clustering (Joshi et al., arXiv 2008.12905, ICDE 2021, Indian metro food data). | A (snippets), A (paper) | 0.8 | DoorDash, Gurobi (vendor). | We do not need Gurobi. At 20 riders and under 30 open orders, a greedy "best pair first" pass inside a batch window is close enough. Hungarian is a later swap. |
| D4 | Assign when the food is near ready, not when the order is placed. Too early = rider waits at kitchen. Too late = food sits. | Grab "Cutting down the time delivery-partners wait at food outlets" (8 Mar 2023): delayed allocation with a buffer based on prep time; average rider wait fell from 6.4 to 5.6 min (Q2 to Q3 2022). DoorDash 2020 post: dispatch weighs "time waiting for an order to be ready". Swiggy Instamart picking post (Bytes, about 2022): the system "targets the arrival of the DE to the dark store before the order is packed". Swiggy "Just in Time assignment" since 2016 (ICMR case study, C). | A (Grab, DoorDash, Swiggy) | 0.85 | Grab gains a good story. The 0.8 min gain is their number, region-wide. | Biggest single win for us. We own the kitchen, so we know the real prep state. Assign when (prep time left) is about equal to (rider travel time to kitchen). |
| D5 | Prep time is the hardest input. Restaurants have no reason to report it. Uber infers true prep time after the fact from rider and restaurant signals. | Uber Eats, Zi Wang, QCon NY talk "Time Predictions in Uber Eats" (June 2019). Uber help page: the merchant's default prep time is "the starting point for our delivery person dispatch prediction". Grab added a "mark ready" button to get labels (2023). DoorDash ETA post (Oct 2024): some stores have longer prep for store-specific reasons. | A | 0.85 | Uber, Grab, DoorDash. | We have an edge: own kitchens. Our kitchen screen can stamp "cooking started" and "packed". That is ground truth the aggregators do not have. Log it from day one. |
| D6 | Batching (stacking) 2 to 3 orders per rider is normal. It is capped when it would make a customer wait too long. | Uber "Triple batching for restaurants" (27 Feb 2023): batches of 2 or 3, one or two merchants, "limit orders from being batched if delivery times are expected to be extensive", more likely at lunch and dinner. FoodMatch paper: batch cap of 3, as more is rarely seen in real data (2020). Instacart: grouping first, then assignment (Jeremy Stanley interview, Data Innovation, May 2017). | A | 0.8 | Uber (batching raises courier output per hour). | Allow a batch of 2, same kitchen, drop points in the same direction, only if the first customer's ETA grows by under a set cap (start at 5 min). Batch of 3 later. |
| D7 | Batching hurts the customer when overused: slower, colder food. | Intouch Insight secret-shopper study (2025, 600 orders, US apps): 12% of orders were batched; those took longer and had worse food quality (via Restaurant Business). | B (seller of mystery-shop services) | 0.6 | Intouch sells audits. Restaurant tech vendors sell direct ordering. | Keep the batch cap strict. Measure first-customer delay on every batch. |
| D8 | Dispatch at scale learns rider value. Lyft's online RL matching adds over $30M a year. | Lyft paper (arXiv 2310.13810, 2023), switchback tests in most markets. | A | 0.75 | Lyft. | Stage 3 only. Needs lots of data. Not for now. |
| D9 | Our own riders change the rules. Aggregators must consider "will the rider accept?". DoorDash's scoring uses predicted acceptance. | DoorDash 2021 post, via quoted snippet. | A (snippet) | 0.65 | DoorDash. | Our riders are our own staff, so acceptance is near certain. We can skip acceptance models and offer flows. Simpler than DoorDash. |

### 1b. Spatial grid, zones and capacity

| # | Claim | Evidence (source, date) | Tier | Conf. | Who gains | What it changes for GoServe |
|---|---|---|---|---|---|---|
| S1 | Uber built H3, a hexagon grid, for pricing and dispatch. Surge is set from supply and demand per hexagon. Hexagons cut the error when people move. | Uber "H3: Uber's Hexagonal Hierarchical Spatial Index" (Isaac Brodsky, 27 Jun 2018). H3 is open source on GitHub (Apache 2.0). | A | 0.9 | Uber (open source helps hiring). | Pin codes are uneven in size. Add an H3 cell id (resolution 8, about 0.7 km² per cell) to every order and rider ping. The `h3-pg` Postgres extension exists; check Supabase support before use. |
| S2 | Quick commerce works by a small radius. Zepto's founder: farthest point 2.5 to 3 km, average 1.8 km. | Zepto CEO interview quoted in ITLN (about 2022). | A (founder quote, via press) | 0.65 | Zepto (fundraise story). | Cap each kitchen's serving radius at about 3 km road distance at first. Pin code is a coarse gate; radius is the real one. |
| S3 | When riders are short, platforms switch services off rather than miss promises. Swiggy paused Genie in 3 metros in 2022 for lack of riders, to protect food and Instamart. | Deccan Herald and Outlook Business (2022). Swiggy has a dedicated "Serviceability Platform" (Bytes, "Designing the Serviceability Platform at Swiggy for High Scale, Part 1"; full text not fetched). | C (news), A (title only) | 0.7 | Swiggy (protects the main brand). | Build a capacity throttle: per zone, if pending orders per free rider passes a limit, raise the shown ETA, then close the zone. Closing beats a broken promise. |
| S4 | DoorDash moves supply ahead of demand with incentives (pay boosts), not by ordering riders to move. | Chinese mirror of a DoorDash engineering post (Tencent Cloud, undated). | C (mirror) | 0.45 | DoorDash. | Our riders are staff. We can simply ask an idle rider to wait at a busy kitchen. Cheap pre-positioning. Test later. |

### 1c. ETA

| # | Claim | Evidence (source, date) | Tier | Conf. | Who gains | What it changes for GoServe |
|---|---|---|---|---|---|---|
| E1 | Delivery time = max(assignment delay + first mile, prep time) + last mile. | Swiggy Bytes "The Swiggy Delivery Challenge (Part One)" (2019), via a secondary summary; Swiggy "Delivery Time" post says assignment delay and first mile are hard to estimate. | A (via C summary) | 0.75 | Swiggy. | Use this exact formula in Stage 1. It is simple and correct in shape. |
| E2 | Uber's ETA = a routing engine's road ETA, plus an ML model that predicts the error (residual). It answers in milliseconds and is Uber's highest-QPS model. | Uber "DeepETA: How Uber Predicts Arrival Times" (Feb 2022). DeeprETA paper (Hu et al., arXiv 2206.02127, 2022). Earlier model was XGBoost. | A | 0.9 | Uber. | Stage 2: Ola Maps gives the road ETA. Our residual model can start as "per kitchen, per hour, median error" and grow later. |
| E3 | DoorDash predicts a distribution of delivery time, not one number. A separate decision layer picks what to show for each business goal. ETA accuracy rose 20% relative. | DoorDash "Improving ETAs with multi-task models..." (12 Mar 2024), via snippets. | A (snippet) | 0.75 | DoorDash. | Show a range, not one number. Promise the slow end (around P80 to P90). Track P50 for ops. |
| E4 | Rare very late orders hurt trust and raise churn more than average error. Manual padding can do more harm than good, so DoorDash audits it. | DoorDash long-tail ETA post (2021) and ETA padding auditor post (2024-25), via snippets. | A (snippet) | 0.7 | DoorDash. | Measure "late by more than 10 min" as a first-class number, not only average ETA. Do not hand-pad ETAs; set padding from data. |
| E5 | Zepto ETA uses regression models (linear, trees, XGBoost) on distance, traffic, history, rider data. | Analytics Vidhya (Oct 2025). | C | 0.35 | The blog (traffic). | Ignore as evidence. Nothing changes. |

### 1d. Customer transparency

| # | Claim | Evidence (source, date) | Tier | Conf. | Who gains | What it changes for GoServe |
|---|---|---|---|---|---|---|
| T1 | Showing the work behind a wait makes people value it more, even with the same wait. | Buell and Norton, "The Labor Illusion", *Management Science* (2011), lab experiments. Buell, Kim, Tsay (2017, *Management Science*): cafeteria where diners see cooks. | A (peer-reviewed) | 0.8 | The authors (academic status). Effect size in food delivery is unknown. | Show kitchen stages: "Order accepted", "Cooking", "Packed", "Rider picked up", "Near you". Own kitchens make these real, not fake. |
| T2 | Long waits raise cancellations. Cancellation risk changes after the expected time passes (reference-dependent). | *Transportation Research Part A*, vol. 198 (2025), Asian on-demand food platform data, survival analysis. A 2024 conference paper on Swiggy data: longer waits raise cancellation odds; reassignment can lower risk (SPIE proceedings). | A (peer-reviewed), C (conference, weaker) | 0.75 | Authors. Platforms shared data. | Do not let the shown ETA be passed silently. When an order will miss it, update the ETA and say why before the time runs out. |
| T3 | Telling the customer the food has left cuts cancellation sharply. | *Journal of Business Research* (Mar 2021), "Longer waiting, more cancellation?", via a secondary article. Not read in full. | A (via C) | 0.6 | Authors. | Push a "picked up" notification. Cheap. Test the effect on our cancels. |
| T4 | Live rider tracking is the norm. Zomato bought Sparse Labs (2015) to show real-time GPS rider location to customer and restaurant; support staff use the same view. | VentureBeat, Inc42 (2015). HyperTrack case study on Zomato (vendor). | C (news), C (vendor) | 0.7 that it is the norm; 0.3 on any effect size | Zomato, HyperTrack (sells tracking). | Show rider name, photo and a live dot after pickup. Give support the same view. |
| T5 | Branded tracking cut "where is my order" contacts by 27% to 50% at some retailers. | nShift blog (vendor, undated). Navixy (vendor): support spends 30-50% of time on status calls. | C (vendors) | 0.3 | The vendors sell tracking. | No decision on this alone. Measure our own WISMO (where is my order) calls before and after. |
| T6 | Consumers cannot see the restaurant's acceptance or prep status, which breaks the cancel and refund system. | Hong Kong Consumer Council press release (June 2025). | A (regulator) | 0.75 | The council (consumer-champion role). | Show acceptance and prep status. It is also a fairness point for refunds. |

### 1e. Architecture

| # | Claim | Evidence (source, date) | Tier | Conf. | Who gains | What it changes for GoServe |
|---|---|---|---|---|---|---|
| A1 | Order life is a state machine. Uber's fulfillment platform models entities with Statecharts, stores them in Spanner, and runs side effects and timers from an action table written in the same transaction, scanned by workers (at-least-once). | Uber "Fulfillment Platform Re-architecture" (July 2021); InfoQ summary (Aug 2021). | A | 0.85 | Uber. | Same shape fits Postgres: `orders.status` with allowed transitions enforced in SQL; an `order_events` table written in the same transaction; n8n or `pg_cron` workers read it. Matches our current design. |
| A2 | Decisions run in fast services and solvers, not LLMs. DoorDash: ML scores + MIP. Uber: ETA in milliseconds. Swiggy: P99 prediction 71 ms. | D3, E2, Akka story. | A / C | 0.85 | — | The "Rules" engine must be SQL, deterministic, and fast. A small model (Laya/Jev) may advise on edge cases, never sit in the hot path of every assignment. |
| A3 | Swiggy's assignment had a one-minute SLA for a whole city. | Akka story (vendor, undated). | C | 0.55 | Akka. | A 30 to 60 s batch window is in line with what Swiggy tolerates. Our 30 s ping fits. |

### 1f. The opposite view

| # | Claim | Evidence (source, date) | Tier | Conf. | Who gains | What it changes for GoServe |
|---|---|---|---|---|---|---|
| O1 | The 10-minute promise pushed riders to speed. After a 31 Dec 2025 strike, the Labour Minister met Blinkit, Zepto, Swiggy and Zomato. All dropped "10-minute" branding by 14 Jan 2026. | Gulf News, Outlook Business, The Week (PTI), Jan 2026. Reuters interviews: all 13 Blinkit and Zepto riders said deadlines led to speeding (via Inside Retail). Al Jazeera feature (28 Jan 2026). | C (news, many outlets, one event), P-like (Reuters interviews) | 0.85 that it happened | Unions, media, government (all have a stake). Platforms call it voluntary. | Never show the rider a countdown that punishes lateness. Promise the customer a range we can hit at legal speeds. Rider ETA uses a safe speed, not a race speed. |
| O2 | Founder said the countdown was never shown to riders, so it did not create pressure. | Deepinder Goyal, as reported (2022 and 2026 coverage). | A (founder statement) | 0.4 that pressure was absent | Zomato/Eternal. | Riders felt pressure anyway (O1). Hiding the timer is not enough; the promise itself creates the pressure. |
| O3 | 10-minute cooked food did not work for Zomato. "Instant" (2022-23) and "Quick" (2025) were shut. Goyal: no incremental demand, kitchen setup not ready, inconsistent experience. | Business Standard (Jan 2023); Outlook Business on Eternal Q4 FY25 results (2025). | A (founder on earnings call, via press) | 0.75 | Eternal (explains a write-off). | A fast promise only pays when demand values it. Aim for a reliable 25 to 35 min first, not 10 min. |
| O4 | Labour standards on these platforms are low. Fairwork India 2024: Swiggy and Zomato 6 of 10, Zepto 4 of 10; no platform committed to a living wage. | Fairwork India Ratings 2024 (IIIT Bangalore and Oxford Internet Institute, Oct 2024), 440 worker interviews. | A (research group) | 0.8 | Fairwork (advocacy role). | Our dispatch fairness rule (fewest trips today) is a real feature. Keep it in the cost function. |
| O5 | Over-batching makes food late and cold (see D7). | Intouch Insight (2025). | B | 0.6 | Intouch. | Strict batch cap. |

---

## 2. What GoServe should build first

The idea in one line: **assign by "when will the food be ready", in small batches, with a strict cap on stacking, and close a zone before breaking a promise.**

A kirana-store picture: today we send the nearest delivery boy the second the order rings. He stands at the counter for 12 minutes while the food cooks. A smart owner waits, looks at all the orders in the last half minute, and sends each boy so he walks in just as the bag is sealed.

### Stage 1: now (Postgres + n8n, no maps API, free)

**Algorithm: "ready-time batch matching".**
1. Every 30 s (one `pg_cron` job, or one n8n schedule calling one SQL function), collect:
   - open orders whose **send time** has come: `now() >= ready_at - travel_to_kitchen(rider) - 2 min`;
   - free riders with a fresh ping (under 90 s old).
2. `ready_at` = order time + kitchen prep estimate. The estimate is the median of our own "accepted to packed" stamps for that kitchen and hour (fallback: a fixed 15 min until we have 30 orders).
3. Travel estimate without maps: straight-line distance × 1.4 (detour factor) ÷ 15 km/h. Both numbers are tunables in a `params` row, so we can fix them from data.
4. Cost of a rider-order pair = travel time to kitchen + max(0, rider arrives early by more than 3 min) penalty + small fairness weight × trips today.
5. Match: sort all pairs by cost, take the best pair, remove that rider and order, repeat. This is greedy, but inside a batch window, so order 2 is not starved by order 1.
6. Stacking: a second order joins a rider only if same kitchen, ready within 5 min of the first, and the first customer's ETA grows by under 5 min. Max 2 per rider.
7. Zone throttle: per pin-code zone, if (orders waiting) ÷ (free riders + riders due back in 10 min) is over 2, add 10 min to the shown ETA. Over 3, stop new orders for that zone and say why.

**Why:** D4 (ready-time) is the clearest Tier A win and costs nothing. D1 and D2 show batch windows beat per-order greedy. D3 says full Hungarian is not needed at our size. S3 and O1 say a closed zone is better than a broken promise or a speeding rider. Everything is SQL, so it is fast and testable (A2).

**Smallest test (in the synthetic city, no real customers):**
- **Hypothesis:** Ready-time batch matching cuts rider wait at the kitchen by at least 30% and does not raise the customer's delivery time, versus today's per-order nearest-rider rule.
- **Design:** Replay the same seeded order stream (same seed, one lunch peak of 2 hours, 10 kitchens, 20 riders) twice: once with the current `dispatch_candidates` rule, once with the new rule. Three seeds each.
- **Measure:** median and P90 rider wait at kitchen (arrived to picked up); median and P90 order-to-door time; share of orders late by over 10 min; rider trips spread (max minus min trips per rider).
- **Decision rule:** Ship if rider wait drops by 30% or more AND P90 order-to-door does not rise by more than 1 min on all three seeds. If wait drops but P90 rises, shorten the send-time margin and rerun once. If neither moves, keep the old rule and log it.

**ETA shown in Stage 1:** a range. Low end = P50 of (prep left + first mile + last mile) from E1. High end = the P90. Both from our own logs; until we have 50 delivered orders, use prep 15 to 20 min plus straight-line travel.

### Stage 2: with Ola Maps road ETA

**Algorithm:** same batch matcher, but travel times come from Ola Maps road ETAs (distance matrix for the riders × kitchens in the window; cache by H3 cell pair for 10 min to save calls). Add a residual correction: per kitchen and hour, the median of (actual minus Ola ETA), like Uber's DeepETA idea (E2) in its simplest form. Swap greedy for the Hungarian algorithm (`scipy.optimize.linear_sum_assignment` in a small worker, or a SQL port) only if the test below says it helps.

**Why:** Straight-line × 1.4 fails in Delhi near flyovers, the Yamuna, and one-way lanes. Road ETA fixes the inputs. Uber and DoorDash both show the input (ETA) matters more than the solver. The residual layer is cheap and proven in shape.

**Smallest test:**
- **Hypothesis:** Ola road ETA plus residual cuts the error of "rider arrives at kitchen" and "arrives at door" by at least 25% versus straight-line × 1.4.
- **Design:** For 2 weeks of real orders, compute both estimates for every trip; dispatch still uses the old one (shadow mode).
- **Measure:** mean absolute error and P90 error in minutes, per leg.
- **Decision rule:** Switch dispatch to Ola if both legs improve by 25% or more. If only one leg improves, use Ola for that leg only. Separately: Hungarian vs greedy on the same logged windows; adopt Hungarian only if total cost falls by 5% or more.

### Stage 3: thousands of riders and kitchens

**Algorithm:** H3 cells (resolution 8) for supply and demand per cell. A min-cost-flow or MIP matcher per city shard, solved every 10 to 30 s in a dedicated service (not n8n). Predicted prep time from a small model on kitchen load. ETA as a distribution with a decision layer (E3). Pre-positioning: ask idle riders to wait in cells with forecast demand (S4). Later, learned rider value like Lyft (D8).

**Why:** At this size, overlap between orders is high, so better matching pays (D2, D8). n8n cannot run a 10 s loop for a city. This is what Uber, DoorDash and Lyft run.

**Smallest test:** switchback test (alternate the old and new matcher by 30-minute blocks, per zone, for 2 weeks), as Lyft did. Measure P90 order-to-door and rider idle time. Ship only on a 5% or better P90 gain with no rise in rider speed alerts.

---

## 3. Customer transparency we can show

Ranked by strength of evidence, strongest first.

1. **Stage timeline with real kitchen stamps:** "Order accepted" → "Cooking" → "Packed" → "Rider on the way" → "Arriving". Each with a time. Evidence: T1 (A, 0.8), T6 (A, 0.75). Our own kitchens make it honest.
2. **ETA as a range, kept honest:** "Arrives 7:40 to 7:50 pm". Update it the moment it slips, before the old time passes. Evidence: T2 (A, 0.75), E3 (A, 0.75), E4 (A, 0.7).
3. **Reason for a delay, in plain words:** "Rain in your area, riders are slower", "Kitchen is busy, your food goes in next". Evidence: T2 (reference point moves), T1. Effect size unknown.
4. **Proactive push at pickup:** "Ravi picked up your order". Evidence: T3 (A via C, 0.6).
5. **Rider name, photo, call button (masked number), and a live dot after pickup.** Evidence: T4 (C, 0.7 that it is the norm). It is table stakes, not proven to cut cancels.
6. **Zone closed message with a reason and a time to retry**, rather than taking an order we will be late on. Evidence: S3, O1, O3.
7. **Same tracking view for support staff.** Evidence: T4 (vendor, low). Cheap, so do it.

Do not show: a countdown timer to riders (O1, O2). A single exact minute number (E3, E4).

---

## 4. Open questions that need our own test

Everything under 0.7, plus big unknown sizes. Each goes into `docs/research/experiments.md` when we run it.

| Open question | Current confidence | Smallest test |
|---|---|---|
| Does batch matching beat per-order greedy at our size? | 0.6 for our size (D2 is Lyft scale) | Stage 1 sim replay above. |
| What batch window is best: 15, 30 or 60 s? | 0.5 | Same sim, three windows, pick the lowest P90 order-to-door. |
| Does stacking 2 orders save rider time without hurting the first customer? | 0.6 (D7) | Sim with stacking on vs off. Measure first customer's extra minutes. Keep only if under 5 min at P90. |
| Detour factor 1.4 and 15 km/h: right for Delhi? | 0.4 | Compare with the first 100 real trips (GPS track length vs straight line, and time). |
| How much does a "picked up" push cut cancels? | 0.6 (T3) | Real orders, A/B by order id parity for 2 weeks. Measure cancel rate after pickup. |
| How much does live tracking cut "where is my order" calls? | 0.3 (T5, vendors only) | Count WISMO calls per 100 orders for 2 weeks before and after the tracking screen. |
| Does showing a delay reason lower cancellations versus just a new ETA? | 0.5 | A/B on delayed orders only. |
| Zone throttle limits (2 and 3 orders per free rider): right? | 0.5 | Sim with a rider-shortage scenario; tune to keep late-by-10-min under 5%. |
| Does pre-positioning idle riders at busy kitchens help? | 0.45 (S4) | Sim: idle riders park at the top-demand kitchen vs stay put. Measure first-mile time. |
| Is `h3-pg` available on our Supabase plan? | unknown | Run `create extension h3` on a branch database. If not, compute H3 in n8n or the app with `h3-js`. |

---

## 5. Sources

Tier in brackets. Vendor sources are marked **(vendor)**.

**Dispatch and assignment**
- [A] Lyft: Azagirre et al., "A Better Match for Drivers and Riders: Reinforcement Learning at Lyft", arXiv 2310.13810, Oct 2023. https://arxiv.org/abs/2310.13810
- [A] Lyft Engineering, "Solving Dispatch in a Ridesharing Problem Space". https://eng.lyft.com/solving-dispatch-in-a-ridesharing-problem-space-821d9606c3ff (fetch refused; read via search snippet)
- [A] DoorDash, "Next-Generation Optimization for Dasher Dispatch at DoorDash", Holly Jin, 28 Feb 2020. https://careersatdoordash.com/?p=1350 (fetch refused; snippets)
- [A] DoorDash, "Using ML and Optimization to Solve DoorDash's Dispatch Problem", Aug 2021. https://careersatdoordash.com/blog/using-ml-and-optimization-to-solve-doordashs-dispatch-problem/ (fetch refused; snippets and a forum quote)
- [A] Joshi, Singh, Ranu, Bagchi, Karia, Kala, "Batching and Matching for Food Delivery in Dynamic Road Networks" (FoodMatch), arXiv 2008.12905, ICDE 2021. https://arxiv.org/abs/2008.12905
- [A] Grab, "Cutting down the time delivery-partners wait at food outlets", 8 Mar 2023. https://www.grab.com/inside-grab/stories/cutting-down-wait-times-delivery-drivers/
- [A] Uber, "Triple batching for restaurants", 27 Feb 2023. https://www.uber.com/au/en/blog/triple-batching-for-restaurants
- [A] Uber careers, "Senior Software Engineer - Delivery Matching". https://www.uber.com/careers/list/144090
- [A] Swiggy Bytes, "Optimising the picking process to enable faster deliveries for Instamart". https://bytes.swiggy.com/optimizing-the-picking-process-to-enable-faster-deliveries-for-instamart-93de0fe9d819 (snippet)
- [A] Swiggy Bytes, "The Swiggy Delivery Challenge (Part One)", 2019. https://bytes.swiggy.com/the-swiggy-delivery-challenge-part-one-6a2abb4f82f6 (fetch failed; formula via secondary summary)
- [A] Swiggy Bytes, "Designing the Serviceability Platform at Swiggy for High Scale, Part 1". https://bytes.swiggy.com/designing-the-serviceability-platform-at-swiggy-for-high-scale-part-1-751a631f0379 (fetch failed; title only)
- [C] **(vendor)** Akka (Lightbend), Swiggy customer story. https://akka.io/customer-stories/swiggy
- [A] Instacart: Jeremy Stanley interview, Center for Data Innovation, May 2017. https://datainnovation.org/2017/05/5-qs-for-jeremy-stanley-vice-president-of-data-science-at-instacart/
- [C] **(vendor)** Gurobi, Instacart case study. https://gurobi.com/case_studies/instacart-delivering-optimal-shopping-experiences
- [C] ICMR case study, "Swiggy's Delivery Model". https://icmrindia.org/casestudies/catalogue/Leadership%20and%20Entrepreneurship/Swiggys_Delivery_Model-Excerpts.htm

**Spatial**
- [A] Uber, "H3: Uber's Hexagonal Hierarchical Spatial Index", Isaac Brodsky, 27 Jun 2018. https://www.uber.com/blog/h3/
- [A] H3 open source. https://github.com/uber/h3
- [A via press] Zepto CEO on store radius, ITLN. https://itln.in/e-commerce/e-commerce-magic-warehousing-tech-changes-and-more-1348188
- [C] Swiggy Genie pause, Deccan Herald, 2022. https://deccanherald.com/business/dearth-of-delivery-workers-forces-swiggy-to-pause-genie-1108181.html
- [C] Tencent Cloud mirror of DoorDash supply-demand post. https://developer.cloud.tencent.com/article/2070523

**ETA**
- [A] Uber, "DeepETA: How Uber Predicts Arrival Times", 2022. https://www.uber.com/en-GB/blog/deepeta-how-uber-predicts-arrival-times/
- [A] Hu et al., "DeeprETA: An ETA Post-processing System at Scale", arXiv 2206.02127, 2022. https://arxiv.org/abs/2206.02127
- [A] Zi Wang, "Time Predictions in Uber Eats", QCon New York, June 2019. https://archive.qconnewyork.com/node/75368 ; InfoQ write-up https://www.infoq.com/articles/uber-eats-time-predictions
- [A] Uber, "Delivery person wait time" (merchant help). https://www.uber.com/au/en/blog/delivery-person-wait-time/
- [A] DoorDash, "Improving ETAs with multi-task models...", 12 Mar 2024. https://careersatdoordash.com/?p=12391 (snippets)
- [A] DoorDash, "Precision in Motion" ETA post, Oct 2024. https://careersatdoordash.com/?p=12607 (snippets)
- [C] Analytics Vidhya, "The Data Science Behind Zepto's 10-Minute Delivery", Oct 2025. https://www.analyticsvidhya.com/blog/2025/10/zepto-data-science/

**Transparency and cancellations**
- [A] Buell and Norton, "The Labor Illusion: How Operational Transparency Increases Perceived Value", *Management Science*, 2011. https://pubsonline.informs.org/doi/10.1287/mnsc.1110.1376
- [A] "Understanding order cancellation behavior in on-demand delivery services", *Transportation Research Part A* 198, 2025. https://ideas.repec.org/a/eee/transa/v198y2025ics0965856425001430.html
- [A via C] "Longer waiting, more cancellation? Empirical evidence from an on-demand service platform", *Journal of Business Research*, Mar 2021 (not read in full).
- [C] Swiggy-data cancellation paper, SPIE proceedings 13219, 2024. https://astronomicaltelescopes.spiedigitallibrary.org/conference-proceedings-of-spie/13219/132192C/Causal-insights-and-predictive-models-for-order-cancellations-in-online/10.1117/12.3036507.full
- [A] Hong Kong Consumer Council, food delivery platform complaints, June 2025. https://www.consumer.org.hk/en/press-release/p-584-food-delivery-platform-complaints
- [C] Zomato acquires Sparse Labs, VentureBeat, 2015. https://venturebeat.com/business/zomato-sparse-labs-acquisition
- [C] **(vendor)** HyperTrack, Zomato case study. https://stories.hypertrack.com/delighting-the-customer-delight-team-at-zomato/
- [C] **(vendor)** nShift, order tracking and support calls. https://nshift.com/blog/order-tracking-customer-experience
- [C] **(vendor)** Navixy, customer experience. https://navixy.com/location-intelligence/customer-experience

**Architecture**
- [A] Uber, "Fulfillment Platform Re-architecture", July 2021. https://www.uber.com/en-IN/blog/fulfillment-platform-rearchitecture/
- [C] InfoQ summary, Aug 2021. https://www.infoq.com/news/2021/08/uber-rearchitecture

**Opposite view**
- [C] Gulf News, "Swiggy, Blinkit drop 10-minute delivery after Indian govt flags rider safety", Jan 2026. https://gulfnews.com/world/asia/india/swiggy-blinkit-drop-10-minute-delivery-after-indian-govt-flags-rider-safety-1.500406940
- [C] The Week (PTI), 14 Jan 2026. https://www.theweek.in/wire-updates/business/2026/01/14/curtains-on-10-min-delivery-zepto-swiggy-flipkart-follow-blinkit-to-drop-branding.amp.html
- [C] Outlook Business, Jan 2026. https://www.outlookbusiness.com/start-up/e-commerce/quick-commerce-giants-drop-10-minute-delivery-promise-after-govt-intervention
- [C] Al Jazeera, "India curbs 'grocery under 10 minutes'. But riders must still fatally race", 28 Jan 2026. https://www.aljazeera.com/features/2026/1/28/india-curbs-grocery-under-10-minutes-but-riders-must-still-fatally-race
- [C] Inside Retail, Reuters rider interviews. https://insideretail.asia/?p=56814
- [A] Fairwork India Ratings 2024. https://ruralindiaonline.org/en/library/resource/fairwork-india-ratings-2024-labour-standards-in-the-platform-economy/
- [A via press] Zomato Instant closure, Business Standard, Jan 2023. https://www.business-standard.com/article/companies/zomato-shuts-10-minute-delivery-service-after-it-struggles-to-grow-123012301118_1.html
- [A via press] Eternal Q4 FY25, Goyal on Quick and Everyday, Outlook Business. https://www.outlookbusiness.com/corporate/eternal-q4-results-deepinder-goyal-doesnt-see-profitability-path-in-zomatos-2-initiatives
- [B] **(vendor of audits)** Intouch Insight batching study, via Restaurant Business, 2025. https://www.restaurantbusinessonline.com/technology/batched-delivery-orders-take-longer-hurt-food-quality
