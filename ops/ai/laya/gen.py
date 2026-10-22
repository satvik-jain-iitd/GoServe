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


def _support(rnd, i, seeds):
    text, topic, mood, human = seeds[i]
    return {"state": _wrap(rnd, text), "questions": SUPPORT_Q, "_seed": seeds[i],
            "expected": {"topic": topic, "mood": mood, "needs_human": bool(human)}, "_sc": ["support", i]}


def _notes(rnd, i, seeds):
    note, allergy, special = seeds[i]
    return {"state": "Order note: " + _wrap(rnd, note), "questions": NOTES_Q, "_seed": seeds[i],
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


def near_duplicates(new, old, thr=0.6):
    """Indexes of texts in new whose character-trigram Jaccard with any text in old is at least thr."""
    grams = lambda t: {t[i:i + 3] for i in range(max(len(t) - 2, 1))} if (t := " ".join(t.lower().split())) else set()
    olds = [grams(t) for t in old]
    out = []
    for i, t in enumerate(new):
        g = grams(t)
        if any(len(g & o) / max(len(g | o), 1) >= thr for o in olds):
            out.append(i)
    return out


def build(seed=0, scale=1.0, train_counts=None, human_weight=1, extra_support=(), extra_notes=()):
    """train_counts overrides the train sizes (0 allowed); human_weight repeats needs_human support seeds in train only;
    extra_support and extra_notes are seed dicts that join train only (never val or test)."""
    rnd = random.Random(seed)
    sup = _split_seeds(SUPPORT, lambda t: (t[1], t[2], t[3]))
    note_idx = _split_seeds(NOTES, lambda t: (t[1], t[2]))
    all_sup = SUPPORT + [(d["text"], d["topic"], d["mood"], int(d["needs_human"])) for d in extra_support]
    all_notes = NOTES + [(d["text"], int(d["has_allergy"]), int(d["has_special_request"])) for d in extra_notes]
    sup = {k: list(v) for k, v in sup.items()}
    note_idx = {k: list(v) for k, v in note_idx.items()}
    sup["train"] += range(len(SUPPORT), len(all_sup))
    note_idx["train"] += range(len(NOTES), len(all_notes))
    out, seen = {}, set()
    for split, counts in BASE.items():
        rows = []
        if split == "train" and train_counts:
            counts, scale_ = train_counts, 1.0
        else:
            scale_ = scale
        pool = sup[split] + [i for i in sup[split] if all_sup[i][3]] * (human_weight - 1) if split == "train" else sup[split]
        for kind, n in counts.items():
            n = round(n) if split == "train" and train_counts else max(1, round(n * scale_))
            made, tries = 0, 0
            while made < n:
                tries += 1
                assert tries < n * 200, f"cannot make {n} unique {kind} cases for {split}"
                if kind == "support":
                    row = _support(rnd, rnd.choice(pool), all_sup)
                elif kind == "notes":
                    row = _notes(rnd, rnd.choice(note_idx[split]), all_notes)
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
                _, topic, mood, human = r["_seed"]
                assert exp == {"topic": topic, "mood": mood, "needs_human": bool(human)}, r
            elif kind == "notes":
                _, a, s = r["_seed"]
                assert exp == {"has_allergy": bool(a), "has_special_request": bool(s)}, r
            elif kind == "refund":
                assert exp["refund"] == refund_rule(*r["_p"]), r
            else:
                assert exp["at_risk"] == late_rule(*r["_p"]), r


def write_retrain(base_dir, out_dir, seed, train_counts, human_weight=1, extra_support=(), extra_notes=()):
    """New train.jsonl; val and test are copied byte for byte from base_dir. Train never shares a state with them."""
    os.makedirs(out_dir, exist_ok=True)
    keep = set()
    for name in ("val", "test"):
        text = open(os.path.join(base_dir, name + ".jsonl"), encoding="utf-8").read()
        open(os.path.join(out_dir, name + ".jsonl"), "w", encoding="utf-8").write(text)
        keep |= {json.loads(l)["state"] for l in text.splitlines()}
    rows = [r for r in build(seed, train_counts=train_counts, human_weight=human_weight, extra_support=extra_support, extra_notes=extra_notes)["train"] if r["state"] not in keep]
    validate({"train": rows})
    with open(os.path.join(out_dir, "train.jsonl"), "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps({k: v for k, v in r.items() if not k.startswith("_")}, ensure_ascii=False) + "\n")
    return len(rows)


def heldout_rows(support_path, notes_path):
    """Laya rows from held-out seed files (never trained on): the text as written, no wrapper noise."""
    rows = []
    for line in open(support_path, encoding="utf-8"):
        d = json.loads(line)
        rows.append({"state": d["text"], "questions": SUPPORT_Q,
                     "expected": {"topic": d["topic"], "mood": d["mood"], "needs_human": bool(d["needs_human"])}})
    for line in open(notes_path, encoding="utf-8"):
        d = json.loads(line)
        rows.append({"state": "Order note: " + d["text"], "questions": NOTES_Q,
                     "expected": {"has_allergy": bool(d["has_allergy"]), "has_special_request": bool(d["has_special_request"])}})
    return rows


def _context_state(rnd, o, text):
    """Order context plus the customer message, in one of 3 shapes."""
    items = ", ".join(o["items"])
    f = rnd.randrange(3)
    if f == 0:
        return (f"Order: {o['restaurant']} | items: {items} | Rs {o['amount']} | placed {o['minutes_since_order']} min ago | "
                f"status: {o['status']} | pay: {o['payment']} | city: {o['city']}\nCustomer: {text}")
    if f == 1:
        return json.dumps({"order": o, "message": text}, ensure_ascii=False)
    return (f"{o['restaurant']} order of {items} (Rs {o['amount']}, {o['payment']}) placed {o['minutes_since_order']} minutes ago "
            f"is {o['status']} in {o['city']}. Customer message: {text}")


def context_rows(seeds, rnd):
    """Laya rows for support seeds that carry an order context; one row per seed, labels from the seed."""
    return [{"state": _context_state(rnd, d["order"], d["text"]), "questions": SUPPORT_Q,
             "expected": {"topic": d["topic"], "mood": d["mood"], "needs_human": bool(d["needs_human"])}} for d in seeds]


def _note_rows(notes):
    return [{"state": "Order note: " + d["text"], "questions": NOTES_Q,
             "expected": {"has_allergy": bool(d["has_allergy"]), "has_special_request": bool(d["has_special_request"])}} for d in notes]


def write_newkind(base_dir, out_dir, d1_support, d1_notes, d2_support, d2_notes, seed=0, replay=1500, val_frac=0.15, reps=3):
    """New-kind set. D1 (train writer): seeds split into train and val2 by seed. D2 (fresh-test writer): fresh_test.jsonl, never trained.
    train.jsonl = D1 train rows (reps formats per seed) plus a replay sample of base_dir/train.jsonl. val, test and Hindi files copied unchanged."""
    rnd = random.Random(seed)
    ld = lambda f: [json.loads(l) for l in open(f, encoding="utf-8")]
    d1s, d1n, d2s, d2n = ld(d1_support), ld(d1_notes), ld(d2_support), ld(d2_notes)
    # leakage guard: drop D1 seeds that are near-copies of fresh-test seeds or of the old val and test seeds
    ss = _split_seeds(SUPPORT, lambda t: (t[1], t[2], t[3]))
    guard = [d["text"] for d in d2s + d2n] + [SUPPORT[i][0] for sp in ("val", "test") for i in ss[sp]]
    drop = set(near_duplicates([d["text"] for d in d1s], guard)); d1s = [d for i, d in enumerate(d1s) if i not in drop]
    drop = set(near_duplicates([d["text"] for d in d1n], guard)); d1n = [d for i, d in enumerate(d1n) if i not in drop]
    for rows in (d1s, d1n):
        rnd.shuffle(rows)
    cut = lambda rows: int(len(rows) * val_frac)
    val_s, tr_s = d1s[:cut(d1s)], d1s[cut(d1s):]
    val_n, tr_n = d1n[:cut(d1n)], d1n[cut(d1n):]
    train, seen = [], set()
    for _ in range(reps):
        for r in context_rows(tr_s, rnd) + _note_rows(tr_n):
            if r["state"] not in seen:
                seen.add(r["state"]); train.append(r)
    old = ld(os.path.join(base_dir, "train.jsonl"))
    train += rnd.sample(old, min(replay, len(old)))
    rnd.shuffle(train)
    os.makedirs(out_dir, exist_ok=True)
    wr = lambda name, rows: open(os.path.join(out_dir, name), "w", encoding="utf-8").write("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows))
    wr("train.jsonl", train)
    wr("val2.jsonl", context_rows(val_s, rnd) + _note_rows(val_n))
    wr("fresh_test.jsonl", context_rows(d2s, rnd) + _note_rows(d2n))
    for name in ("val.jsonl", "test.jsonl", "hindi_test.jsonl"):
        open(os.path.join(out_dir, name), "wb").write(open(os.path.join(base_dir, name), "rb").read())
    return {"train": len(train), "val2": len(val_s) + len(val_n), "fresh_test": len(d2s) + len(d2n), "dropped_near_copies": len(drop)}


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
