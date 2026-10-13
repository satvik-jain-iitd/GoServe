# GoServe — Laya Replaces Jev

**Date:** 13 Oct 2026
**Status:** Plan. Decision record: `docs/decisions/ADR-005-laya-replaces-jev.md` (proposed).
**Related:** `docs/ai/JEV_D1_D5_CONTRACT.md`, `docs/ai/JEV_INTEGRATION_PLAN.md`, `docs/research/laya-2026-10.md`.

---

## 1. Why

- **Own the model and the data.** No vendor can raise the price or switch it off.
- **Zero API cost.** Laya is free and open (Apache-2.0). It runs on our own server.
- **Fit to our cases.** Fine-tuned on our own orders, it can beat a general model.

Honest cost picture:
- GoServe pays $0 for Jev today. Nothing is live yet.
- At 1 lakh users, Jev would cost about $10 to $20 a month (about 21,000 calls a day, about 400 tokens each, $0.042 per million input tokens, output free).
- So the money saved is small. The bigger win is control, speed of change, and calibrated answers on our own cases.

## 2. What Laya is (from its own page, tier A, confidence 0.6)

- A decision model. It never writes text. It picks from options we give, with a confidence score.
- Question types: `choice` (pick one), `score` (a level), `noul` (yes or no).
- Sizes: English 421M parameters, multilingual 322M.
- `laya-serve` answers on `POST /v1/systemone` **in the same shape as Jev**. So it can drop into our decision step with almost no change.
- Its own numbers: without fine-tuning it is near chance on typed decisions (about 0.36). Fine-tuned, 0.766 versus Jev 1.13 at 0.727 (Jev number published by others).
- Weak spots it admits: more than 20 options, `score` questions, and it ships over-confident until calibrated.
- Speed: about 33 to 40 ms on a T4 GPU. **193 to 464 ms on a CPU.** Our server has no GPU and is ARM. We must measure it ourselves.

So: Laya is better **only after** we fine-tune it on our data. On our CPU it may not be faster than Jev. We claim nothing until we measure.

## 3. Which decisions fit Laya

| Decision | Best tool | Why |
|---|---|---|
| D5 Is the address in our zone? | Code (map math) | Exact. No model needed |
| D2 Delivery time (minutes) | Code (simple statistics on real trips) | A number from past trips beats a guess |
| D1 Which rider? | Rules pick the top 5, Laya picks one | Laya is weak with many options and number-heavy states |
| D3 Which order to cook next? | Rules pick the top 5, Laya picks one | Same reason |
| D4 Is this order at risk of being late? | Laya (`noul`) | Yes or no, clear label later |
| D6 Abuse or refund flag | Laya (`choice`) | Small option list, labels from ops |
| D9 Support message sorting | Laya (`choice`) | Text is Laya's strength |
| Order-note flags ("no onion", allergy) | Laya (`noul`) | Text, small labels |
| Cancel reason, review mood | Laya | Text, small labels |
| D8 Reorder nudge, D10 copilot routing | Laya | Later phases |

Rule (global model ladder): code first, then a small model, then a paid model. We keep the rule whenever Laya does not win.

## 4. What we log from day one (the decision record)

Every decision writes one row (table `decision_log`):

- id, use case, schema version, kitchen id, session id
- state (with names, phones and addresses removed)
- the options we offered
- the rule's pick
- Jev's pick, confidence, time taken, model name
- Laya's pick and confidence (when Laya runs quietly)
- the pick we used, and its chance of being picked
- settings version
- place: `demo`, `pilot` or `prod`
- the result later: what really happened, who said so, and when

Demo rows are never used for training.

## 5. Where the labels come from (easiest first)

1. **Our own results.** Was the order late? How long did the trip take? Did the customer order again? Free and honest.
2. **Ops changes.** When ops changes the rider by hand, that is a strong label.
3. **Owner or ops thumbs** on Telegram for a sample of decisions.
4. **An order simulator.** It makes realistic orders, riders and delays. It is also our load test in MVP 3.
5. **Synthetic examples written by Claude** in Claude Code sessions, checked by rules. Only for a cold start and rare cases. A capped share. Never in the test set.
6. **Jev's answers as teacher labels.** Owner decision, 13 Oct 2026: the answers Jev gives us are our output, so we use them to train Laya. We use only high-confidence Jev answers. Teacher labels teach Laya to match Jev; real results (items 1 to 3) are what let Laya beat Jev.

The final test set is **real data only**.

## 6. One trap: we only see the result of the choice we made

If the rule always picks rider A, we never learn what rider B would have done. Then Laya only learns to copy the rule. Fixes:

- Log every option, the chosen one, and its chance of being picked.
- In low-risk decisions only, sometimes pick at random among the safe top options.
- Judge Laya by on-time % and cost, not by how often it agrees with Jev.

## 7. How we train

1. Read the official Laya notebook first, to get the exact dataset fields: `notebooks/laya_finetune_typed_decisions_2xT4_kaggle.ipynb`.
2. Build the dataset from `decision_log` rows with labels.
3. Train on free GPUs (Kaggle 2×T4 or Colab). The author says about 4 hours.
4. Fit the confidence (one temperature per question type), on our data.
5. Compare against the rule and Jev on the real test set.
6. Save to a private Hugging Face repo.
7. Serve with `laya-serve` (Docker) on our Oracle server. Try `laya[onnx]` for speed.
8. Try both the English and the multilingual model. Customer notes are often in Hinglish.
9. Reuse what we learned with Laya in the Miraya growth engine.

## 8. When Laya may replace Jev (the gate, per decision)

All must be true. The pass mark and sample size are fixed before the test.

- Beats the rule and Jev on on-time % or accuracy, on the real test set.
- Confidence is as honest as Jev's or better.
- 95% of answers in under 500 ms on our ARM server.
- 2 weeks running quietly next to Jev on live traffic.
- Then 10% of live traffic. Then all.
- The order of backup: Laya → Jev → rule. A kill switch in `params`.

## 9. Timeline

| Phase | Laya step |
|---|---|
| MVP 0 | Log every decision in the final shape. Build the simulator and a small synthetic seed |
| MVP 1 | Real orders. Jev logged. Results added after each delivery |
| MVP 2 | Laya v1 trained. Runs quietly next to Jev |
| MVP 3 | Laya live where it wins. Weekly retrain |
| MVP 4 | Laya trained per city |

## 10. Links

- Model: https://huggingface.co/convaiinnovations/laya
- Code: https://github.com/NandhaKishorM/laya
- Author's page: https://laya.convaiinnovations.com/
- Papers: https://arxiv.org/abs/2503.23303, https://arxiv.org/abs/2510.01237
