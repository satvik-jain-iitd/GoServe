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


def test_heldout_rows_fit_laya_format():
    # Held-out seed files become Laya rows with the same questions and no wrapper noise.
    with tempfile.TemporaryDirectory() as d:
        sp, nt = os.path.join(d, "s.jsonl"), os.path.join(d, "n.jsonl")
        open(sp, "w", encoding="utf-8").write(json.dumps({"text": "खाना ठंडा था", "topic": "quality", "mood": "negative", "needs_human": False, "style": "devanagari", "ambiguous": False}, ensure_ascii=False) + "\n")
        open(nt, "w", encoding="utf-8").write(json.dumps({"text": "बिना प्याज", "has_allergy": False, "has_special_request": True, "style": "devanagari", "ambiguous": False}, ensure_ascii=False) + "\n")
        rows = gen.heldout_rows(sp, nt)
    assert [r["state"] for r in rows] == ["खाना ठंडा था", "Order note: बिना प्याज"]
    assert rows[0]["expected"] == {"topic": "quality", "mood": "negative", "needs_human": False}
    assert rows[1]["expected"] == {"has_allergy": False, "has_special_request": True}
    assert set(rows[0]) == ROW_KEYS and rows[0]["questions"] == gen.SUPPORT_Q


def test_rules_exact_on_every_number_row():
    # The code path for refund and late risk: the rule in code gives the label on 100% of rows of every file.
    rows = [r for v in gen.build(seed=0).values() for r in v if r["_sc"][0] in ("refund", "late")]
    assert len(rows) > 500
    for r in rows:
        want = gen.refund_rule(*r["_p"]) if r["_sc"][0] == "refund" else gen.late_rule(*r["_p"])
        assert list(r["expected"].values())[0] == want, r


def test_near_duplicate_filter():
    # A new seed that is a near-copy of an existing one is flagged; a different one is not.
    old = ["rider ne dhamki di ki bad review diya to dekh lunga", "खाना ठंडा था"]
    new = ["rider ne dhamki di ki bad review diya to dekh lunga!!", "The curry had a bad smell and I feel sick", "खाना ठंडा था"]
    assert gen.near_duplicates(new, old) == [0, 2]


def test_zero_counts_and_extra_seeds_in_train_only():
    # train_counts may be 0 (no number rows), and extra seeds appear in train only.
    extra_s = [{"text": "Rider ne raat ko mujhe baar baar call kiya aur gande message bheje", "topic": "rider_issue", "mood": "negative", "needs_human": True}]
    extra_n = [{"text": "please ring only once, I am recovering from surgery", "has_allergy": False, "has_special_request": True}]
    counts = {"support": 3000, "notes": 600, "refund": 0, "late": 0}
    sp = gen.build(seed=3, train_counts=counts, extra_support=extra_s, extra_notes=extra_n)
    assert not [r for r in sp["train"] if r["_sc"][0] in ("refund", "late")]
    assert any(r["_sc"] == ["support", len(gen.SUPPORT)] for r in sp["train"]), "extra support seed never drawn"
    assert any(r["_sc"] == ["notes", len(gen.NOTES)] for r in sp["train"]), "extra note seed never drawn"
    for name in ("val", "test"):
        assert not any(r["_sc"][1] is not None and r["_sc"][1] >= (len(gen.SUPPORT) if r["_sc"][0] == "support" else len(gen.NOTES)) for r in sp[name] if r["_sc"][0] in ("support", "notes"))
    gen.validate(sp)


def test_retrain_set_with_extra_seeds_and_no_number_rows():
    # Round 3 set: val and test unchanged, train holds the extra seeds, and has no refund or late rows.
    extra_s = [{"text": "Mujhe rider ne raat ko dhamkaya aur gaali di, police ko bolunga", "topic": "rider_issue", "mood": "negative", "needs_human": True}]
    with tempfile.TemporaryDirectory() as base, tempfile.TemporaryDirectory() as out:
        gen.write(base, seed=0, scale=0.1)
        gen.write_retrain(base, out, seed=2, train_counts={"support": 1500, "notes": 20, "refund": 0, "late": 0}, extra_support=extra_s)
        for f in ("val.jsonl", "test.jsonl"):
            assert open(os.path.join(base, f), "rb").read() == open(os.path.join(out, f), "rb").read(), f
        train = [json.loads(l) for l in open(os.path.join(out, "train.jsonl"), encoding="utf-8")]
    assert any("police ko bolunga" in r["state"] or "police ko bolunga".upper() in r["state"].upper() for r in train)
    assert not [r for r in train if "refund" in r["expected"] or "at_risk" in r["expected"]]


def _ctx_seed(i, topic="order_late", human=False):
    return {"order": {"restaurant": "Sharma Rasoi", "items": ["dal makhani", "2 roti"], "amount": 349 + i, "minutes_since_order": 70,
                      "status": "out_for_delivery", "payment": "UPI", "city": "Indore"},
            "text": " ".join(f"w{(i * 31 + k * 17) % 997}q{(i * 7 + k) % 89}" for k in range(7)) + f" aaya {i}", "topic": topic, "mood": "negative", "needs_human": human, "style": "hinglish", "ambiguous": False}


def test_context_rows_keep_message_and_labels():
    # New input shape: order context plus message, in 3 formats; labels come from the seed, the message is not altered.
    import random
    seeds = [_ctx_seed(i) for i in range(60)]
    rows = gen.context_rows(seeds, random.Random(1))
    assert len(rows) == 60
    for r, d in zip(rows, seeds):
        assert d["text"] in r["state"] and "Sharma Rasoi" in r["state"] and str(d["order"]["amount"]) in r["state"]
        assert r["expected"] == {"topic": "order_late", "mood": "negative", "needs_human": False} and r["questions"] == gen.SUPPORT_Q
    assert len({r["state"][:8] for r in rows}) >= 3, "at least 3 formats"


def test_write_newkind_splits_seeds_and_keeps_old_files():
    # D1 seeds split into train and val2 by seed; D2 is the fresh test; old val, test and Hindi files are copied unchanged.
    with tempfile.TemporaryDirectory() as base, tempfile.TemporaryDirectory() as out, tempfile.TemporaryDirectory() as src:
        gen.write(base, seed=0, scale=0.1)
        open(os.path.join(base, "hindi_test.jsonl"), "w").write("")
        d1 = [_ctx_seed(i, "order_late" if i % 2 else "quality") for i in range(200)]
        d2 = [_ctx_seed(1000 + i) for i in range(50)]
        notes = [{"text": "no spice please", "has_allergy": False, "has_special_request": True, "style": "english", "ambiguous": False}] * 3
        w = lambda name, rows: open(os.path.join(src, name), "w", encoding="utf-8").write("".join(json.dumps(r) + "\n" for r in rows))
        notes2 = [dict(n, text="hand the parcel to the guard at gate B, my mother is not well " + str(i)) for i, n in enumerate(notes)]
        w("d1s.jsonl", d1); w("d1n.jsonl", notes); w("d2s.jsonl", d2); w("d2n.jsonl", notes2)
        gen.write_newkind(base, out, os.path.join(src, "d1s.jsonl"), os.path.join(src, "d1n.jsonl"), os.path.join(src, "d2s.jsonl"), os.path.join(src, "d2n.jsonl"), seed=4, replay=40, val_frac=0.15)
        ld = lambda f: [json.loads(l) for l in open(os.path.join(out, f), encoding="utf-8")]
        for f in ("val.jsonl", "test.jsonl", "hindi_test.jsonl"):
            assert open(os.path.join(base, f), "rb").read() == open(os.path.join(out, f), "rb").read(), f
        train, val2, fresh = ld("train.jsonl"), ld("val2.jsonl"), ld("fresh_test.jsonl")
    assert len(fresh) == 50 + 3 and len(val2) >= 30 and len(train) > 200
    import re
    nums = lambda rows: {m.group(1) for r in rows for m in [re.search(r"aaya (\d+)", r["state"])] if m}
    assert nums(fresh) and nums(val2) and not nums(fresh) & nums(train) and not nums(val2) & nums(train)


def test_fresh_test_drops_near_copies_of_training_seeds():
    # A fresh-test seed that is a near-copy of a D1 train seed or of an old train seed is removed from the fresh test.
    with tempfile.TemporaryDirectory() as base, tempfile.TemporaryDirectory() as out, tempfile.TemporaryDirectory() as src:
        gen.write(base, seed=0, scale=0.1)
        open(os.path.join(base, "hindi_test.jsonl"), "w").write("")
        d1 = [_ctx_seed(i) for i in range(60)]
        d2 = [_ctx_seed(1000 + i) for i in range(10)]
        d2[0] = dict(d1[5]); d2[1] = dict(d2[1], text=gen.SUPPORT[0][0] + "!")
        w = lambda name, rows: open(os.path.join(src, name), "w", encoding="utf-8").write("".join(json.dumps(r) + "\n" for r in rows))
        w("d1s.jsonl", d1); w("d1n.jsonl", []); w("d2s.jsonl", d2); w("d2n.jsonl", [])
        summary = gen.write_newkind(base, out, os.path.join(src, "d1s.jsonl"), os.path.join(src, "d1n.jsonl"), os.path.join(src, "d2s.jsonl"), os.path.join(src, "d2n.jsonl"), seed=1, replay=5)
        fresh = [json.loads(l) for l in open(os.path.join(out, "fresh_test.jsonl"), encoding="utf-8")]
    assert len(fresh) == 8 and summary["fresh_dropped"] == 2, (len(fresh), summary)


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok", name)
