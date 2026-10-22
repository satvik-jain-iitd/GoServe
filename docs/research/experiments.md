# Experiments

One row per test. Never delete a row. A failed test is as useful as a passed one.

| ID | Hypothesis | Design | Start | Result | Decision |
|---|---|---|---|---|---|
| E1 | The official Laya fine-tune notebook runs end to end on free Kaggle 2xT4 with our accounts. | Run it for 1 epoch on the official `typed-decisions` data. Change only EPOCHS, the repo name and private. | 2026-10-22 | Pass for train, calibrate, evaluate (accuracy 0.654, ECE 0.110, 141 ms per case on T4, 1 epoch; the Jev row in the table is a typed-in constant). Fail at the upload cell: no HF_TOKEN in a run started by the CLI. | Pipeline works. Upload is tested with our own model (F101). No claim about Laya vs Jev from this run. |
| E2 | Laya fine-tuned on our synthetic data beats base Laya zero-shot by 20+ points and has ECE under 0.10 on the synthetic test file. | Train on `ops/ai/laya/gen.py` data (seed 0). Compare tuned, base, majority class and the rule on `test.jsonl`. Rule fixed before the run. | 2026-10-22. Rule made exact BEFORE any tuned number: pass = macro accuracy over all 7 questions at least base + 0.20, AND macro ECE under 0.10, AND tuned accuracy not below the majority guess on any question. Base zero-shot (CPU, seed 0 test, 390 rows): macro accuracy 0.533; per question: topic 0.54, mood 0.49, needs_human 0.63, has_allergy 1.00, has_special_request 0.35, refund 0.29, at_risk 0.43. Base macro ECE 0.24. | pending (training running on Kaggle T4) | Pass shows the pipeline learns. It does not show the model works for real customers (A54). |
