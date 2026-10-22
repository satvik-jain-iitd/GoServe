"""Makes synthetic Laya training data for GoServe decisions. Stdlib only.
Run: python3 ops/ai/laya/gen.py OUT_DIR [--seed N] [--scale X]
Writes train.jsonl, val.jsonl, test.jsonl in the format of laya.train.finetune:
{"state": str, "questions": {...}, "expected": {...}}.

Text cases (support, notes) come from hand-written seed messages, split by seed so the
test file holds phrasings the model never saw. Number cases (refund, late) get their
label from a rule, so the label is exact. Synthetic data proves the pipeline only.
"""
import json, os, random, re, sys

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

# (message, topic, mood, needs_human). {item} {item2} {mins} {n} are filled at build time.
SUPPORT = [
    ("{item} abhi tak nahi aaya, {mins} minute ho gaye", "order_late", "negative", 0),
    ("Order is taking forever, it was supposed to arrive {mins} minutes ago", "order_late", "negative", 0),
    ("kitni der lagegi? bhookh lagi hai, {mins} min se wait kar raha hoon", "order_late", "negative", 0),
    ("Delivery is a bit late but no problem, just checking the status", "order_late", "neutral", 0),
    ("Delivered before time, thanks!", "order_late", "positive", 0),
    ("On time delivery aur garam khana, bahut khushi hui", "order_late", "positive", 0),
    ("Where is my order? App shows preparing since {mins} minutes", "order_late", "negative", 0),
    ("order late hai, please jaldi bhejo", "order_late", "negative", 0),
    ("Still waiting for {item}. Can you tell me the new ETA?", "order_late", "neutral", 0),
    ("{mins} min ho gaye, rider ka number do", "order_late", "negative", 0),
    ("Maine {item} order kiya tha, par {item2} aaya hai", "wrong_item", "negative", 0),
    ("You sent the wrong item, I ordered {item}", "wrong_item", "negative", 0),
    ("ek item missing hai, raita nahi aaya", "wrong_item", "negative", 0),
    ("Order mein {item} nahi tha, sirf rice aaya", "wrong_item", "negative", 0),
    ("Wrong order delivered, this is not mine", "wrong_item", "negative", 0),
    ("Half the order is missing, please check", "wrong_item", "negative", 0),
    ("Got extra {item2} I did not order, no issue, just letting you know", "wrong_item", "neutral", 0),
    ("sab kuch sahi aaya, shukriya", "wrong_item", "positive", 0),
    ("{item} thanda tha aur bilkul swaad nahi tha", "quality", "negative", 0),
    ("Food was cold and stale", "quality", "negative", 0),
    ("khana bahut accha tha, thank you!", "quality", "positive", 0),
    ("Loved the {item}, will order again", "quality", "positive", 0),
    ("{item} mein bahut tel tha, thoda heavy laga", "quality", "negative", 0),
    ("Portion size was very small for the price", "quality", "negative", 0),
    ("Tasty food and quick packing, good job", "quality", "positive", 0),
    ("swaad lajawab tha, best {item} in town", "quality", "positive", 0),
    ("Fresh and hot, the {item} was superb", "quality", "positive", 0),
    ("{item} was okay, nothing special", "quality", "neutral", 0),
    ("khane mein baal mila, ghin aa rahi hai", "quality", "negative", 1),
    ("Found an insect in my {item}, I feel sick", "quality", "negative", 1),
    ("khana khane ke baad ulti ho rahi hai", "quality", "negative", 1),
    ("Paisa kat gaya par order confirm nahi hua", "payment", "negative", 0),
    ("I was charged twice for the same order", "payment", "negative", 0),
    ("UPI payment failed but money deducted", "payment", "negative", 0),
    ("refund kab milega? {n} din ho gaye", "payment", "negative", 0),
    ("Coupon did not apply, please fix the bill", "payment", "neutral", 0),
    ("Bill mein extra charge laga hai", "payment", "negative", 0),
    ("How do I pay cash on delivery?", "payment", "neutral", 0),
    ("Payment was smooth, loved the easy checkout", "payment", "positive", 0),
    ("Rider ne phone nahi uthaya, address pe nahi aaya", "rider_issue", "negative", 0),
    ("The delivery guy was rude to me", "rider_issue", "negative", 1),
    ("Rider ne bahut badtameezi se baat ki", "rider_issue", "negative", 1),
    ("Rider left the food outside the gate without calling", "rider_issue", "negative", 0),
    ("rider bahut helpful tha, thank you", "rider_issue", "positive", 0),
    ("Rider was polite and quick, five stars", "rider_issue", "positive", 0),
    ("Rider asked for extra money", "rider_issue", "negative", 1),
    ("Rider is waiting downstairs, coming now", "rider_issue", "neutral", 0),
    ("app mein login nahi ho raha", "other", "neutral", 0),
    ("Do you deliver to sector {n}?", "other", "neutral", 0),
    ("kal ka menu kya hai?", "other", "neutral", 0),
    ("Can I change my address for the next order?", "other", "neutral", 0),
    ("I will complain to the consumer court and post on social media", "other", "negative", 1),
    ("tum log chor ho, police ko bulaunga", "other", "negative", 1),
    ("Great app!", "other", "positive", 0),
    ("Please add more veg options", "other", "neutral", 0),
]

# (note, has_allergy, has_special_request)
NOTES = [
    ("no onion no garlic", 0, 1), ("peanut allergy please, it is serious", 1, 1),
    ("extra spicy", 0, 1), ("gate code 4521, call on arrival", 0, 1),
    ("kisi ko dairy se allergy hai, bina paneer ke", 1, 1), ("less oil please", 0, 1),
    ("bhaiya thoda jaldi", 0, 0), ("birthday hai, candle laga dena", 0, 1),
    ("no cutlery", 0, 1), ("gluten free please, celiac", 1, 1),
    ("dont ring the bell, baby sleeping", 0, 1), ("thanks", 0, 0), ("ok", 0, 0),
    ("mujhe cashew se allergy hai", 1, 1), ("pack separately", 0, 1),
    ("good food last time", 0, 0), ("shellfish allergy, anaphylaxis risk", 1, 1),
    ("extra raita please", 0, 1), ("allergic to eggs", 1, 1),
    ("bahut bhookh lagi hai", 0, 0), ("sauce alag se dena", 0, 1),
    ("i am lactose intolerant, no cream", 1, 1), ("hello", 0, 0),
    ("leave with the guard at the gate", 0, 1), ("less sugar, diabetic", 0, 1),
    ("sesame se reaction hota hai", 1, 1), ("please make it fresh", 0, 0),
    ("3rd floor, lift kharab hai", 0, 1),
]

ITEMS = ["paneer butter masala", "biryani", "masala dosa", "veg thali", "chole bhature", "momos", "dal makhani", "rajma chawal", "pav bhaji", "chicken curry"]
OPENERS = ["", "", "Hi, ", "Hello bhaiya, ", "Sir ", "Hey ", "Namaste, "]
CLOSERS = ["", "", " please help", " jaldi reply do", " thanks", " pls", "."]

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
BASE = {"train": {"support": 800, "notes": 400, "refund": 400, "late": 400},
        "val": {"support": 100, "notes": 50, "refund": 50, "late": 50},
        "test": {"support": 150, "notes": 80, "refund": 80, "late": 80}}


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


def _split_seeds(rows, key):
    """Per group, every 5th seed -> test, the one two before it -> val, rest -> train. Returns {split: [idx]}."""
    out = {"train": [], "val": [], "test": []}
    groups = {}
    for i, row in enumerate(rows):
        groups.setdefault(row[key], []).append(i)
    for idxs in groups.values():
        for j, i in enumerate(idxs):
            out["test" if j % 5 == 4 else "val" if j % 5 == 2 else "train"].append(i)
    return out


def _typo(rnd, s):
    if len(s) > 6 and rnd.random() < 0.15:
        i = rnd.randrange(1, len(s) - 2)
        s = s[:i] + s[i + 1] + s[i] + s[i + 2:]
    return s.lower() if rnd.random() < 0.2 else s


def _wrap(rnd, msg):
    msg = _typo(rnd, rnd.choice(OPENERS) + msg + rnd.choice(CLOSERS))
    return f"Order #{rnd.randint(1000, 9999)}: {msg}" if rnd.random() < 0.5 else msg


def _support(rnd, i):
    msg, topic, mood, human = SUPPORT[i]
    it = rnd.sample(ITEMS, 2)
    msg = msg.format(item=it[0], item2=it[1], mins=rnd.randint(20, 90), n=rnd.randint(2, 9))
    return {"state": _wrap(rnd, msg), "questions": SUPPORT_Q,
            "expected": {"topic": topic, "mood": mood, "needs_human": bool(human)}, "_sc": ["support", i]}


def _notes(rnd, i):
    note, allergy, special = NOTES[i]
    return {"state": "Order note: " + _wrap(rnd, note), "questions": NOTES_Q,
            "expected": {"has_allergy": bool(allergy), "has_special_request": bool(special)}, "_sc": ["notes", i]}


def refund_state(issue, late, r, amt, age):
    return f"Order total Rs {amt}. Delivered {late} min after the promised time. Issue: {issue}. Refunds in last 30 days: {r}. Customer account age: {age} days."


def _refund(rnd, target):
    for _ in range(500):
        p = (rnd.choice(REFUND_ISSUES), rnd.choice([0, 0, 5, 15, 30, 45, 70, 100]), rnd.randint(0, 5),
             rnd.randrange(150, 2500, 10), rnd.choice([2, 5, 20, 90, 400]))
        if refund_rule(*p) == target:
            return {"state": refund_state(*p), "questions": REFUND_Q, "expected": {"refund": target}, "_sc": ["refund", None]}
    raise RuntimeError("no refund case for " + target)


def late_state(age, sla, status, prep, eta):
    return (f"Order placed {age} min ago. Promised within {sla} min. Status: {status}. "
            f"Kitchen needs about {prep} more min. Rider needs {eta} min to reach the customer.")


def _late(rnd, target):
    for _ in range(500):
        sla = rnd.choice([30, 40, 45, 60])
        status = rnd.choice(LATE_STATUS)
        p = (rnd.randint(5, sla + 15), sla, status, rnd.randint(1, 25) if status == "preparing" else 0, rnd.randint(3, 30))
        if late_rule(*p) == target:
            return {"state": late_state(*p), "questions": LATE_Q, "expected": {"at_risk": target}, "_sc": ["late", None]}
    raise RuntimeError("no late case")


def build(seed=0, scale=1.0):
    rnd = random.Random(seed)
    sup = _split_seeds(SUPPORT, 1)
    note_idx = _split_seeds([{"g": 0}] * len(NOTES), "g")
    out, seen = {}, set()
    for split, counts in BASE.items():
        rows = []
        for kind, n in counts.items():
            n = max(1, round(n * scale))
            made, tries = 0, 0
            while made < n:
                tries += 1
                assert tries < n * 200, f"cannot make {n} unique {kind} cases for {split}"
                if kind == "support":
                    row = _support(rnd, rnd.choice(sup[split]))
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
                m = re.fullmatch(r"Order total Rs (\d+)\. Delivered (\d+) min after the promised time\. Issue: (\w+)\. Refunds in last 30 days: (\d+)\. Customer account age: (\d+) days\.", r["state"])
                amt, late, issue, rf, age = m.groups()
                assert exp["refund"] == refund_rule(issue, int(late), int(rf), int(amt), int(age)), r
            else:
                m = re.fullmatch(r"Order placed (\d+) min ago\. Promised within (\d+) min\. Status: (\w+)\. Kitchen needs about (\d+) more min\. Rider needs (\d+) min to reach the customer\.", r["state"])
                a, sla, st, prep, eta = m.groups()
                assert exp["at_risk"] == late_rule(int(a), int(sla), st, int(prep), int(eta)), r


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
