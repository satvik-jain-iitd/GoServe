"""Judges raw predictions from kaggle/eval.py against the E3 targets in docs/research/experiments.md.
Usage: python3 score.py raw_TAG.json DATA_DIR [--latin] [--text-only] [--by-language] [--test NAME] [--val NAME] [--bar 0.85]
--latin scores only rows without Indic script (the English and Hinglish scope, owner decision 22 Oct 2026);
the temperature is then fitted on the same kind of val rows. The test file itself is never changed.
Targets: accuracy >= 0.90, ECE <= 0.08 each, macro ECE <= 0.05, at least 0.05 above the majority guess;
needs_human recall >= 0.90 and precision >= 0.85."""
import json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import metrics

raw = json.load(open(sys.argv[1]))
d, scope = sys.argv[2], "--latin" in sys.argv
load = lambda n: [json.loads(l) for l in open(f"{d}/{n}.jsonl", encoding="utf-8")]
arg = lambda f, d: sys.argv[sys.argv.index(f) + 1] if f in sys.argv else d
BAR = float(arg("--bar", "0.90"))  # accuracy bar; 0.85 for the Hindi held-out slice
train, val, test = load("train"), load(arg("--val", "val")), load(arg("--test", "test"))
pick = lambda rows: metrics.latin_only(rows) if scope else list(range(len(rows)))
iv, it, itr = pick(val), pick(test), pick(train)
val_rows, val_raw = [val[i] for i in iv], [raw["val"][i] for i in iv]
test_rows, test_raw = [test[i] for i in it], [raw["test"][i] for i in it]
temps = {}
for q in {q for r in val_rows for q in r["expected"]}:
    pairs = [(a[q]["p"], a[q]["labels"].index(r["expected"][q])) for r, a in zip(val_rows, val_raw) if q in a]
    temps[q] = metrics.fit_temperature([p for p, _ in pairs], [g for _, g in pairs], lo=0.2)
rep_raw = metrics.report(test_rows, metrics.from_raw(test_raw))
rep = metrics.report(test_rows, metrics.from_raw(test_raw, temps))
maj = metrics.majority_accuracy([train[i] for i in itr], test_rows)
print(f"scope: {'English + Hinglish only' if scope else 'all rows'} | test rows {len(test_rows)} of {len(test)}, val rows {len(val_rows)} of {len(val)}")
print(f"{'question':20}{'n':>4}{'acc':>7}{'maj':>7}{'ECEraw':>8}{'ECEcal':>8}{'T':>6}  accuracy  ece  >=maj+.05")
ok = {}
qs = sorted(rep)
if "--text-only" in sys.argv:  # round 3: refund and at_risk run as code, Laya is judged on the 5 text decisions
    qs = [q for q in qs if q in ("topic", "mood", "needs_human", "has_allergy", "has_special_request")]
for q in qs:
    a, e = rep[q]["accuracy"], rep[q]["ece"]
    ok[q] = (a >= BAR, e <= 0.08, a >= maj[q] + 0.05)
    print(f"{q:20}{rep[q]['n']:>4}{a:>7.3f}{maj[q]:>7.3f}{rep_raw[q]['ece']:>8.3f}{e:>8.3f}{temps[q]:>6.2f}  " + "  ".join("PASS" if x else "FAIL" for x in ok[q]))
hp = [(r["expected"]["needs_human"], a["needs_human"]["p"][1] >= 0.5) for r, a in zip(test_rows, test_raw) if "needs_human" in r["expected"]]
p, r = metrics.precision_recall([g for g, _ in hp], [x for _, x in hp])
macro_acc = sum(rep[q]["accuracy"] for q in qs) / len(qs)
macro_ece = sum(rep[q]["ece"] for q in qs) / len(qs)
print(f"macro accuracy {macro_acc:.3f} | macro ECE {macro_ece:.3f} ({'PASS' if macro_ece <= 0.05 else 'FAIL'}) | needs_human precision {p:.3f} recall {r:.3f} ({'PASS' if p >= 0.85 and r >= 0.90 else 'FAIL'}, {sum(g for g, _ in hp)} positives)")
print("use cases fully passing:", [q for q in qs if all(ok[q])])

# Coverage check (owner scope: Hindi, English, Hinglish): each group needs >= 60 test rows and macro accuracy >= 0.85.
if "--by-language" in sys.argv:
    print("\nlanguage coverage (accuracy needs no temperature):")
    for lang in ("english", "hinglish", "hindi"):
        idx = [i for i, r in enumerate(test_rows) if metrics.language(r["state"]) == lang]
        sub = metrics.report([test_rows[i] for i in idx], metrics.from_raw([test_raw[i] for i in idx]))
        macro = sum(v["accuracy"] for v in sub.values()) / len(sub)
        print(f"  {lang:9} rows {len(idx):>4}  macro accuracy {macro:.3f}  {'PASS' if len(idx) >= 60 and macro >= 0.85 else 'FAIL'}   " + "  ".join(f"{q} {v['accuracy']:.2f} (n={v['n']})" for q, v in sorted(sub.items())))
