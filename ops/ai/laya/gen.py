"""Makes synthetic Laya training data for GoServe decisions. Stdlib only.
Run: python3 ops/ai/laya/gen.py OUT_DIR [--seed N] [--scale X]
Writes train.jsonl, val.jsonl, test.jsonl in the format of laya.train.finetune:
{"state": str, "questions": {...}, "expected": {...}}.

Text cases (support, notes) come from seed messages in seeds/*.jsonl (two independent writers),
split by seed so the test file holds phrasings the model never saw. Number cases (refund, late) get their
label from a rule, so the label is exact. Synthetic data proves the pipeline only.
"""
import glob, hashlib, json, os, random, sys

TOPICS = {
    "order_late": "Order is late or the customer asks where it is",
    "wrong_item": "Wrong, missing or extra item in the order",
    "quality": "Food taste, temperature, portion or hygiene",
    "payment": "Charge, refund, coupon or bill problem",
    "rider_issue": "Rider behaviour or rider could not deliver",
    "other": "Anything else (app, area, menu, general talk)",
}
MOODS = {"positive": "Customer is happy", "neutral": "Customer is calm or just asking", "negative": "Customer is upset"}
REFUND = {"approve": "Refund the customer", "review": "Send to a human to decide", "reject": "Do not refund"}

def _load(prefix):
    """Seed dicts from seeds/<prefix>*.jsonl; the first of any repeated text wins."""
    seen, out = set(), []
    for f in sorted(glob.glob(os.path.join(os.path.dirname(os.path.abspath(__file__)), "seeds", prefix + "*.jsonl"))):
        for line in open(f, encoding="utf-8"):
            d = json.loads(line)
            key = " ".join(d["text"].lower().split())
            if key not in seen:
                seen.add(key)
                out.append(d)
    return out


# (message, topic, mood, needs_human) and (note, has_allergy, has_special_request)
SUPPORT = [(d["text"], d["topic"], d["mood"], int(d["needs_human"])) for d in _load("support_")]
NOTES = [(d["text"], int(d["has_allergy"]), int(d["has_special_request"])) for d in _load("notes_")]

SUPPORT_Q = {
    "topic": {"type": "choice", "instructions": "What is this customer message about?", "criteria": TOPICS},
    "mood": {"type": "choice", "instructions": "How does the customer feel?", "criteria": MOODS},
    "needs_human": {"type": "noul", "instructions": "Does a human need to handle this at once (health risk, abuse, threat or rider misbehaviour)?"},
}
NOTES_Q = {
    "has_allergy": {"type": "noul", "instructions": "Does the note mention an allergy or a medical food limit?"},
    "has_special_request": {"type": "noul", "instructions": "Does the note ask the kitchen or rider for something special?"},
}
REFUND_Q = {"refund": {"type": "choice", "instructions": "Should we refund this order?", "criteria": REFUND}}
LATE_Q = {"at_risk": {"type": "noul", "instructions": "Will this order miss its promised time?"}}

REFUND_ISSUES = ["never_arrived", "missing_item", "wrong_item", "cold_food", "none"]
LATE_STATUS = ["preparing", "ready", "out_for_delivery"]
BASE = {"train": {"support": 1400, "notes": 400, "refund": 400, "late": 400},
        "val": {"support": 170, "notes": 50, "refund": 60, "late": 60},
        "test": {"support": 350, "notes": 120, "refund": 150, "late": 150}}


def refund_rule(issue, late, r, amt, age):
    """Teacher rule for refunds. late = minutes late, r = refunds in 30 days, age = account age in days."""
    if age < 7 and amt > 1500:
        return "review"
    if issue == "never_arrived":
        return "approve" if r <= 2 else "review"
    if issue in ("missing_item", "wrong_item"):
        return "approve" if r <= 1 else ("review" if r <= 3 else "reject")
    if issue == "cold_food":
        return "approve" if late >= 30 and r <= 1 else ("review" if r <= 2 else "reject")
    return "approve" if late >= 60 else ("review" if late >= 30 and r == 0 else "reject")


def late_rule(age, sla, status, prep, eta):
    return prep + eta > sla - age - 3


def _split_seeds(items, key):
    """Stratified by key(item), order fixed by a hash of the item: 12 of 20 train, 3 val, 5 test."""
    groups = {}
    for i, it in enumerate(items):
        groups.setdefault(key(it), []).append(i)
    out = {"train": [], "val": [], "test": []}
    for idxs in groups.values():
        idxs.sort(key=lambda i: hashlib.md5(repr(items[i]).encode()).hexdigest())
        for j, i in enumerate(idxs):
            out["test" if j % 20 >= 15 else "val" if j % 20 >= 12 else "train"].append(i)
    return out


def _wrap(rnd, msg):
    if msg.isascii() and len(msg) > 6 and rnd.random() < 0.1:  # swap two letters
        i = rnd.randrange(1, len(msg) - 2)
        msg = msg[:i] + msg[i + 1] + msg[i] + msg[i + 2:]
    if msg.isascii() and rnd.random() < 0.1:
        msg = msg.lower()
    return f"Order #{rnd.randint(1000, 9999)}: {msg}" if rnd.random() < 0.35 else msg


def _support(rnd, i):
    _, topic, mood, human = SUPPORT[i]
    return {"state": _wrap(rnd, SUPPORT[i][0]), "questions": SUPPORT_Q,
            "expected": {"topic": topic, "mood": mood, "needs_human": bool(human)}, "_sc": ["support", i]}


def _notes(rnd, i):
    note, allergy, special = NOTES[i]
    return {"state": "Order note: " + _wrap(rnd, note), "questions": NOTES_Q,
            "expected": {"has_allergy": bool(allergy), "has_special_request": bool(special)}, "_sc": ["notes", i]}


def refund_state(rnd, issue, late, r, amt, age):
    f = rnd.randrange(3)
    if f == 0:
        return f"Order total Rs {amt}. Delivered {late} min after the promised time. Issue: {issue}. Refunds in last 30 days: {r}. Customer account age: {age} days."
    if f == 1:
        return f"Refund request | total: Rs {amt} | late_by_min: {late} | issue: {issue} | refunds_30d: {r} | account_age_days: {age}"
    return json.dumps({"order_total": amt, "minutes_late": late, "issue": issue, "refunds_last_30_days": r,
                       "account_age_days": age, "payment": rnd.choice(["UPI", "COD", "card"])})


def _refund(rnd, target):
    for _ in range(500):
        p = (rnd.choice(REFUND_ISSUES), rnd.choice([0, 0, 5, 10, 15, 25, 30, 35, 45, 55, 60, 70, 100]), rnd.randint(0, 5),
             rnd.randrange(150, 2500, 10), rnd.choice([2, 5, 6, 7, 20, 90, 400]))
        if refund_rule(*p) == target:
            return {"state": refund_state(rnd, *p), "questions": REFUND_Q, "expected": {"refund": target}, "_sc": ["refund", None], "_p": list(p)}
    raise RuntimeError("no refund case for " + target)


def late_state(rnd, age, sla, status, prep, eta):
    f = rnd.randrange(3)
    if f == 0:
        return (f"Order placed {age} min ago. Promised within {sla} min. Status: {status}. "
                f"Kitchen needs about {prep} more min. Rider needs {eta} min to reach the customer.")
    if f == 1:
        return f"placed_min_ago: {age} | sla_min: {sla} | status: {status} | kitchen_left_min: {prep} | rider_eta_min: {eta}"
    return json.dumps({"age_min": age, "promised_min": sla, "status": status, "prep_left_min": prep, "rider_eta_min": eta,
                       "items": rnd.randint(1, 6)})


def _late(rnd, target):
    near = rnd.random() < 0.3  # a third of cases sit within 6 minutes of the line
    for _ in range(2000):
        sla = rnd.choice([30, 40, 45, 60])
        status = rnd.choice(LATE_STATUS)
        p = (rnd.randint(5, sla + 15), sla, status, rnd.randint(1, 25) if status == "preparing" else 0, rnd.randint(3, 30))
        if late_rule(*p) == target and (not near or abs(p[3] + p[4] - (sla - p[0] - 3)) <= 6):
            return {"state": late_state(rnd, *p), "questions": LATE_Q, "expected": {"at_risk": target}, "_sc": ["late", None], "_p": list(p)}
    raise RuntimeError("no late case")


def build(seed=0, scale=1.0, train_counts=None, human_weight=1):
    """train_counts overrides the train sizes; human_weight repeats needs_human support seeds in train only."""
    rnd = random.Random(seed)
    sup = _split_seeds(SUPPORT, lambda t: (t[1], t[2], t[3]))
    note_idx = _split_seeds(NOTES, lambda t: (t[1], t[2]))
    out, seen = {}, set()
    for split, counts in BASE.items():
        rows = []
        if split == "train" and train_counts:
            counts, scale_ = train_counts, 1.0
        else:
            scale_ = scale
        pool = sup[split] + [i for i in sup[split] if SUPPORT[i][3]] * (human_weight - 1) if split == "train" else sup[split]
        for kind, n in counts.items():
            n = max(1, round(n * scale_))
            made, tries = 0, 0
            while made < n:
                tries += 1
                assert tries < n * 200, f"cannot make {n} unique {kind} cases for {split}"
                if kind == "support":
                    row = _support(rnd, rnd.choice(pool))
                elif kind == "notes":
                    row = _notes(rnd, rnd.choice(note_idx[split]))
                elif kind == "refund":
                    row = _refund(rnd, rnd.choice(list(REFUND)))
                else:
                    row = _late(rnd, rnd.random() < 0.5)
                if row["state"] in seen:
                    continue
                seen.add(row["state"])
                rows.append(row)
                made += 1
        rnd.shuffle(rows)
        out[split] = rows
    return out


def validate(splits):
    """Raises AssertionError if any label disagrees with its seed or rule."""
    for rows in splits.values():
        for r in rows:
            kind, i = r["_sc"]
            exp = r["expected"]
            if kind == "support":
                _, topic, mood, human = SUPPORT[i]
                assert exp == {"topic": topic, "mood": mood, "needs_human": bool(human)}, r
            elif kind == "notes":
                _, a, s = NOTES[i]
                assert exp == {"has_allergy": bool(a), "has_special_request": bool(s)}, r
            elif kind == "refund":
                assert exp["refund"] == refund_rule(*r["_p"]), r
            else:
                assert exp["at_risk"] == late_rule(*r["_p"]), r


def write_retrain(base_dir, out_dir, seed, train_counts, human_weight=1):
    """New train.jsonl; val and test are copied byte for byte from base_dir. Train never shares a state with them."""
    os.makedirs(out_dir, exist_ok=True)
    keep = set()
    for name in ("val", "test"):
        text = open(os.path.join(base_dir, name + ".jsonl"), encoding="utf-8").read()
        open(os.path.join(out_dir, name + ".jsonl"), "w", encoding="utf-8").write(text)
        keep |= {json.loads(l)["state"] for l in text.splitlines()}
    rows = [r for r in build(seed, train_counts=train_counts, human_weight=human_weight)["train"] if r["state"] not in keep]
    validate({"train": rows})
    with open(os.path.join(out_dir, "train.jsonl"), "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps({k: v for k, v in r.items() if not k.startswith("_")}, ensure_ascii=False) + "\n")
    return len(rows)


def write(out_dir, seed=0, scale=1.0):
    splits = build(seed, scale)
    validate(splits)
    os.makedirs(out_dir, exist_ok=True)
    for name, rows in splits.items():
        with open(os.path.join(out_dir, name + ".jsonl"), "w") as f:
            for r in rows:
                f.write(json.dumps({k: v for k, v in r.items() if not k.startswith("_")}, ensure_ascii=False) + "\n")
    return {k: len(v) for k, v in splits.items()}


if __name__ == "__main__":
    a = sys.argv[1:]
    opt = lambda f, d: type(d)(a[a.index(f) + 1]) if f in a else d
    print(write(a[0], opt("--seed", 0), opt("--scale", 1.0)))
