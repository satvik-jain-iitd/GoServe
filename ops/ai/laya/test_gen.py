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


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok", name)
