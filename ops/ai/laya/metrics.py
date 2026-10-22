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
