"""Scores for the Laya experiments. Stdlib only.
A prediction is {question_id: (answer, confidence)}; answer is an option label or a bool."""


def accuracy(right):
    return sum(right) / len(right)


def ece(conf, right, bins=10):
    """Expected calibration error: weighted gap between confidence and accuracy per bin."""
    n, total = len(conf), 0.0
    for b in range(bins):
        idx = [i for i, c in enumerate(conf) if min(int(c * bins), bins - 1) == b]
        if idx:
            total += len(idx) / n * abs(sum(right[i] for i in idx) / len(idx) - sum(conf[i] for i in idx) / len(idx))
    return total


def majority_accuracy(train_rows, test_rows):
    """Accuracy of always guessing the most common train answer, per question."""
    out = {}
    for qid in {q for r in test_rows for q in r["expected"]}:
        counts = {}
        for r in train_rows:
            if qid in r["expected"]:
                counts[r["expected"][qid]] = counts.get(r["expected"][qid], 0) + 1
        guess = max(counts, key=counts.get)
        rows = [r for r in test_rows if qid in r["expected"]]
        out[qid] = accuracy([r["expected"][qid] == guess for r in rows])
    return out


def report(rows, preds):
    """Per question: n, accuracy, ece."""
    out = {}
    for qid in {q for r in rows for q in r["expected"]}:
        pairs = [(r["expected"][qid], p[qid]) for r, p in zip(rows, preds) if qid in r["expected"]]
        right = [gold == ans for gold, (ans, _) in pairs]
        out[qid] = {"n": len(pairs), "accuracy": accuracy(right), "ece": ece([c for _, (_, c) in pairs], right)}
    return out


def apply_temperature(p, t):
    """Soften (t > 1) or sharpen (t < 1) a probability vector: softmax(log p / t)."""
    w = [max(x, 1e-9) ** (1 / t) for x in p]
    return [x / sum(w) for x in w]


def fit_temperature(probs, gold, lo=0.5, hi=5.0, step=0.05):
    """The t in [lo, hi] that minimises log loss on (probability vector, gold index) pairs."""
    from math import log
    best, t = None, lo
    while t <= hi + 1e-9:
        nll = -sum(log(max(apply_temperature(p, t)[g], 1e-9)) for p, g in zip(probs, gold))
        if best is None or nll < best[0] - 1e-12:
            best = (nll, t)
        t = round(t + step, 10)
    return best[1]


def precision_recall(gold, pred):
    tp = sum(g and p for g, p in zip(gold, pred))
    return tp / max(sum(pred), 1), tp / max(sum(gold), 1)


def from_raw(raw, temps=None):
    """raw[i][qid] = {"labels": [...], "p": [...]} -> report() input; temps = {qid: t} optional."""
    out = []
    for row in raw:
        pred = {}
        for qid, a in row.items():
            p = apply_temperature(a["p"], temps[qid]) if temps and qid in temps else a["p"]
            k = max(range(len(p)), key=p.__getitem__)
            pred[qid] = (a["labels"][k], p[k])
        out.append(pred)
    return out
