"""Compares seed labels with a blind second labelling. Usage: python3 audit.py KEY.json LABELS.jsonl
Prints the disagreement rate per field and writes the disagreeing seed indexes as JSON on the last line.
Self-check: python3 audit.py --selftest"""
import json, sys

FIELDS = {"s": ("topic", "mood", "needs_human"), "n": ("has_allergy", "has_special_request")}


def compare(key, labels):
    """key = {"support": {idx: seed}, "notes": {idx: seed}}; labels = list of dicts with id like s12 / n3."""
    wrong, total, bad = {}, {}, {"support": set(), "notes": set()}
    for lab in labels:
        kind, idx = lab["id"][0], lab["id"][1:]
        seed = key["support" if kind == "s" else "notes"][idx]
        for f in FIELDS[kind]:
            total[f] = total.get(f, 0) + 1
            if lab[f] != seed[f]:
                wrong[f] = wrong.get(f, 0) + 1
                bad["support" if kind == "s" else "notes"].add(int(idx))
    return {f: wrong.get(f, 0) / total[f] for f in total}, {k: sorted(v) for k, v in bad.items()}


if __name__ == "__main__":
    if sys.argv[1] == "--selftest":
        key = {"support": {"1": {"topic": "a", "mood": "x", "needs_human": False}}, "notes": {"2": {"has_allergy": True, "has_special_request": True}}}
        rate, bad = compare(key, [{"id": "s1", "topic": "b", "mood": "x", "needs_human": False}, {"id": "n2", "has_allergy": True, "has_special_request": True}])
        assert rate["topic"] == 1.0 and rate["mood"] == 0 and rate["has_allergy"] == 0 and bad == {"support": [1], "notes": []}
        print("ok")
    else:
        key = json.load(open(sys.argv[1], encoding="utf-8"))
        labels = [json.loads(l) for l in open(sys.argv[2], encoding="utf-8")]
        rate, bad = compare(key, labels)
        print(json.dumps({f: round(v, 3) for f, v in rate.items()}))
        print(json.dumps(bad))
