"""Kaggle script: score a Laya model on val and test. MODEL=hub id or a path; TAG names the output.
Fits one temperature per question on val, applies it to test. Prints one raw prediction first."""
import glob, json, os, subprocess, sys

subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "laya"])
import laya
import metrics

MODEL, TAG = os.environ.get("MODEL", "convaiinnovations/laya"), os.environ.get("TAG", "base")
data = os.path.dirname(glob.glob("/kaggle/input/**/test.jsonl", recursive=True)[0])
load = lambda n: [json.loads(l) for l in open(f"{data}/{n}.jsonl")]
train, val, test = load("train"), load("val"), load("test")
if MODEL.startswith("/kaggle") and not os.path.isdir(MODEL):  # kernel output mounts under a path we do not know
    MODEL = os.path.dirname(glob.glob("/kaggle/input/**/" + os.path.basename(MODEL) + "/rl_agent_config.json", recursive=True)[0])
agent = laya.load(MODEL)


def raw_answer(q, ans):
    """labels and probabilities over them. choice: option probabilities. noul: [P(false), P(true)]."""
    if q["type"] == "choice":
        labels = list(q["criteria"])
        return {"labels": labels, "p": [float(ans["probabilities"][l]) for l in labels]}
    p = float(ans["noul"])
    return {"labels": [False, True], "p": [1 - p, p]}


def predict(rows):
    out = []
    for i, r in enumerate(rows):
        res = agent.predict(r["state"], r["questions"])
        if i == 0 and rows is val:
            print("RAW", json.dumps(res, default=str)[:800])
        out.append({qid: raw_answer(q, res["answers"][qid]) for qid, q in r["questions"].items()})
    return out


raw_val, raw_test = predict(val), predict(test)
temps = {}
for qid in {q for r in val for q in r["expected"]}:
    pairs = [(a[qid]["p"], a[qid]["labels"].index(r["expected"][qid])) for r, a in zip(val, raw_val) if qid in a]
    temps[qid] = metrics.fit_temperature([p for p, _ in pairs], [g for _, g in pairs], lo=0.2)
hp = [(r["expected"]["needs_human"], a["needs_human"]["p"][1] >= 0.5) for r, a in zip(test, raw_test) if "needs_human" in r["expected"]]
prec, rec = metrics.precision_recall([g for g, _ in hp], [p for _, p in hp])
rep = {"raw": metrics.report(test, metrics.from_raw(raw_test)),
       "cal": metrics.report(test, metrics.from_raw(raw_test, temps)),
       "val_raw": metrics.report(val, metrics.from_raw(raw_val)),
       "temps": temps, "needs_human_precision_recall": [prec, rec],
       "majority": metrics.majority_accuracy(train, test)}
print("REPORT", TAG, json.dumps(rep))
os.makedirs("/kaggle/working", exist_ok=True)
json.dump(rep, open(f"/kaggle/working/report_{TAG}.json", "w"), indent=1)
json.dump({"val": raw_val, "test": raw_test}, open(f"/kaggle/working/raw_{TAG}.json", "w"))
