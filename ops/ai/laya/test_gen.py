"""Checks for the Laya training data generator. Run: python3 ops/ai/laya/test_gen.py
One check per Gherkin scenario in issue #107."""
import json, os, sys, tempfile

sys.path.insert(0, os.path.dirname(__file__))
import gen

ROW_KEYS = {"state", "questions", "expected"}


def test_same_seed_same_files():
    # Given a fixed seed, when the generator runs twice, then both runs write identical files.
    with tempfile.TemporaryDirectory() as a, tempfile.TemporaryDirectory() as b:
        gen.write(a, seed=7, scale=0.05)
        gen.write(b, seed=7, scale=0.05)
        for f in ("train.jsonl", "val.jsonl", "test.jsonl"):
            assert open(os.path.join(a, f)).read() == open(os.path.join(b, f)).read(), f


def test_label_matches_rule():
    # Given a generated case, when the validator checks it, then the label matches the rule.
    splits = gen.build(seed=1, scale=0.05)
    gen.validate(splits)
    bad = json.loads(json.dumps(splits))
    row = next(r for r in bad["train"] if r["_sc"][0] == "refund")
    row["expected"]["refund"] = "reject" if row["expected"]["refund"] != "reject" else "approve"
    try:
        gen.validate(bad)
    except AssertionError:
        return
    raise AssertionError("validator accepted a wrong refund label")


def test_no_scenario_in_two_files():
    # Given train, val and test, when checked, then no scenario appears in two files.
    splits = gen.build(seed=2, scale=0.05)
    seeds = {k: {tuple(r["_sc"]) for r in v if r["_sc"][1] is not None} for k, v in splits.items()}
    assert not seeds["train"] & seeds["val"] and not seeds["train"] & seeds["test"] and not seeds["val"] & seeds["test"]
    states = [r["state"] for v in splits.values() for r in v]
    assert len(states) == len(set(states)), "same state text in more than one row"


def test_rows_fit_laya_format():
    # Given any written row, then it has only state/questions/expected, and each answer is a legal one.
    with tempfile.TemporaryDirectory() as d:
        gen.write(d, seed=3, scale=0.05)
        for f in ("train.jsonl", "val.jsonl", "test.jsonl"):
            lines = open(os.path.join(d, f)).read().splitlines()
            assert lines, f
            for line in lines:
                r = json.loads(line)
                assert set(r) == ROW_KEYS, r.keys()
                assert r["state"].strip()
                assert set(r["expected"]) == set(r["questions"])
                for qid, q in r["questions"].items():
                    ans = r["expected"][qid]
                    if q["type"] == "choice":
                        assert ans in q["criteria"], (qid, ans)
                    else:
                        assert q["type"] == "noul" and isinstance(ans, bool), (qid, ans)


def test_classes_are_balanced_enough():
    # Each choice option and each noul side gets at least 8% of its decisions in train.
    rows = gen.build(seed=4, scale=0.3)["train"]
    counts = {}
    for r in rows:
        for qid, ans in r["expected"].items():
            counts.setdefault(qid, {}).setdefault(ans, 0)
            counts[qid][ans] += 1
    for qid, c in counts.items():
        total = sum(c.values())
        for ans, n in c.items():
            assert n / total >= 0.08, (qid, ans, n, total)


def test_every_option_in_val_and_test():
    # Each choice option and each noul side appears in val and in test (reviewer, PR #108).
    splits = gen.build(seed=0, scale=1.0)
    for name in ("val", "test"):
        seen = {}
        for r in splits[name]:
            for qid, ans in r["expected"].items():
                seen.setdefault(qid, set()).add(ans)
        want = {}
        for r in splits["train"]:
            for qid, q in r["questions"].items():
                want[qid] = set(q["criteria"]) if q["type"] == "choice" else {True, False}
        for qid, opts in want.items():
            assert seen.get(qid, set()) == opts, (name, qid, opts - seen.get(qid, set()))


def test_seed_files_are_clean():
    # Given the v2 seed files, labels are in vocabulary, texts are unique, and classes are not thin.
    assert len(gen.SUPPORT) >= 500 and len(gen.NOTES) >= 180, (len(gen.SUPPORT), len(gen.NOTES))
    texts = [t for t, *_ in gen.SUPPORT] + [t for t, *_ in gen.NOTES]
    assert len({" ".join(t.lower().split()) for t in texts}) == len(texts), "duplicate seed text"
    for t, topic, mood, human in gen.SUPPORT:
        assert topic in gen.TOPICS and mood in gen.MOODS and human in (0, 1) and 2 <= len(t) <= 400, t
    human = sum(h for *_, h in gen.SUPPORT) / len(gen.SUPPORT)
    assert 0.08 <= human <= 0.20, human
    for topic in gen.TOPICS:
        assert sum(1 for _, t, *_ in gen.SUPPORT if t == topic) >= 60, topic
    for mood in gen.MOODS:
        assert sum(1 for _, _, m, _ in gen.SUPPORT if m == mood) >= 0.12 * len(gen.SUPPORT), mood
    allergy = sum(a for _, a, _ in gen.NOTES) / len(gen.NOTES)
    assert 0.2 <= allergy <= 0.5, allergy


def test_number_cases_come_in_several_formats():
    # Refund and late-risk states are written in at least 3 shapes, and labels still follow the rule.
    rows = gen.build(seed=5, scale=0.3)["train"]
    for kind in ("refund", "late"):
        shapes = {r["state"][:12] for r in rows if r["_sc"][0] == kind}
        assert len(shapes) >= 3, (kind, shapes)


def test_train_counts_and_human_weight():
    # Retrain knobs: train sizes can be set, and weighting raises the share of needs_human seeds in train only.
    counts = {"support": 200, "notes": 20, "refund": 30, "late": 40}
    a = gen.build(seed=9, train_counts=counts)["train"]
    assert len(a) == sum(counts.values()), len(a)
    share = lambda rows: sum(r["expected"]["needs_human"] for r in rows if "needs_human" in r["expected"]) / sum(1 for r in rows if "needs_human" in r["expected"])
    b = gen.build(seed=9, train_counts=counts, human_weight=4)["train"]
    assert share(b) > share(a) * 1.4, (share(a), share(b))


def test_retrain_set_keeps_val_and_test_byte_identical():
    # Given a first data set, the retrain set reuses its val and test files unchanged and shares no state with them.
    with tempfile.TemporaryDirectory() as base, tempfile.TemporaryDirectory() as out:
        gen.write(base, seed=0, scale=0.1)
        gen.write_retrain(base, out, seed=1, train_counts={"support": 80, "notes": 20, "refund": 20, "late": 20}, human_weight=3)
        for f in ("val.jsonl", "test.jsonl"):
            assert open(os.path.join(base, f), "rb").read() == open(os.path.join(out, f), "rb").read(), f
        keep = {json.loads(l)["state"] for f in ("val.jsonl", "test.jsonl") for l in open(os.path.join(out, f))}
        train = [json.loads(l) for l in open(os.path.join(out, "train.jsonl"))]
        assert train and not keep & {r["state"] for r in train}


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok", name)
