"""Judges a report_<tag>.json from kaggle/eval.py against the E3 targets in docs/research/experiments.md.
Usage: python3 score.py REPORT.json   (targets: accuracy >= 0.90, ECE <= 0.08 each, macro ECE <= 0.05,
at least 0.05 above the majority guess; needs_human recall >= 0.90 and precision >= 0.85)"""
import json, sys

t = json.load(open(sys.argv[1]))
qs = sorted(t["raw"])
print(f"{'question':20}{'n':>4}{'acc':>7}{'maj':>7}{'ECEraw':>8}{'ECEcal':>8}{'T':>6}  accuracy  ece  >=maj+.05")
ok = {}
for q in qs:
    a, e, m = t["cal"][q]["accuracy"], t["cal"][q]["ece"], t["majority"][q]
    ok[q] = (a >= 0.90, e <= 0.08, a >= m + 0.05)
    print(f"{q:20}{t['raw'][q]['n']:>4}{a:>7.3f}{m:>7.3f}{t['raw'][q]['ece']:>8.3f}{e:>8.3f}{t['temps'][q]:>6.2f}  " + "  ".join("PASS" if x else "FAIL" for x in ok[q]))
macro_acc = sum(t["cal"][q]["accuracy"] for q in qs) / len(qs)
macro_ece = sum(t["cal"][q]["ece"] for q in qs) / len(qs)
p, r = t["needs_human_precision_recall"]
print(f"macro accuracy {macro_acc:.3f} | macro ECE {macro_ece:.3f} ({'PASS' if macro_ece <= 0.05 else 'FAIL'}) | needs_human precision {p:.3f} recall {r:.3f} ({'PASS' if p >= 0.85 and r >= 0.90 else 'FAIL'})")
print("use cases fully passing:", [q for q in qs if all(ok[q])])
