"""Kaggle script: score a Laya model on test.jsonl. MODEL=hub id or a path; TAG names the output.
Prints one raw prediction first, so a changed output shape is easy to see."""
import glob, json, os, subprocess, sys

subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "laya"])
import laya

MODEL, TAG = os.environ.get("MODEL", "convaiinnovations/laya"), os.environ.get("TAG", "base")
here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, here)
import metrics

data = os.path.dirname(glob.glob("/kaggle/input/**/test.jsonl", recursive=True)[0])
load = lambda n: [json.loads(l) for l in open(f"{data}/{n}.jsonl")]
train, test = load("train"), load("test")
if MODEL.startswith("/kaggle") and not os.path.isdir(MODEL):  # kernel output mounts under a path we do not know
    MODEL = os.path.dirname(glob.glob("/kaggle/input/**/" + os.path.basename(MODEL) + "/rl_agent_config.json", recursive=True)[0])
agent = laya.load(MODEL)


def pick(q, ans):
    """(answer, confidence) from one answer dict. choice: label + its probability. noul: P(true)."""
    if q["type"] == "choice":
        label = ans["choice"]
        return label, float((ans.get("probabilities") or {}).get(label, ans.get("confidence", 0.5)))
    p = float(ans["noul"])
    return p >= 0.5, max(p, 1 - p)


preds = []
for i, r in enumerate(test):
    res = agent.predict(r["state"], r["questions"])
    if i == 0:
        print("RAW", json.dumps(res, default=str)[:1500])
    preds.append({qid: pick(q, res["answers"][qid]) for qid, q in r["questions"].items()})
rep = metrics.report(test, preds)
rep["_majority"] = metrics.majority_accuracy(train, test)
print("REPORT", TAG, json.dumps(rep))
os.makedirs("/kaggle/working", exist_ok=True)
json.dump(rep, open(f"/kaggle/working/report_{TAG}.json", "w"), indent=1)
