"""Checks for metrics.py with hand-made numbers. Run: python3 ops/ai/laya/test_metrics.py"""
import os, sys

sys.path.insert(0, os.path.dirname(__file__))
import metrics


def test_accuracy_and_ece_by_hand():
    # 4 decisions: right, right, wrong at conf 0.9; wrong at conf 0.5.
    # Bin 0.9: 3 items, accuracy 2/3, confidence 0.9, gap 0.2333 * 3/4 = 0.175.
    # Bin 0.5: 1 item, accuracy 0, confidence 0.5, gap 0.5 * 1/4 = 0.125. ECE = 0.3.
    right = [True, True, False, False]
    conf = [0.9, 0.9, 0.9, 0.5]
    assert metrics.accuracy(right) == 0.5
    assert abs(metrics.ece(conf, right) - 0.3) < 1e-9


def test_majority_guess_uses_train_labels_only():
    train = [{"expected": {"q": "a"}}, {"expected": {"q": "a"}}, {"expected": {"q": "b"}}]
    test = [{"expected": {"q": "b"}}, {"expected": {"q": "a"}}]
    assert metrics.majority_accuracy(train, test) == {"q": 0.5}


def test_majority_covers_questions_missing_from_first_row():
    train = [{"expected": {"q": "a"}}, {"expected": {"n": True}}, {"expected": {"n": True}}]
    test = [{"expected": {"q": "a"}}, {"expected": {"n": False}}]
    assert metrics.majority_accuracy(train, test) == {"q": 1.0, "n": 0.0}


def test_report_per_question():
    rows = [{"expected": {"q": "a", "n": True}}, {"expected": {"q": "b", "n": False}}]
    preds = [{"q": ("a", 0.8), "n": (True, 0.6)}, {"q": ("a", 0.7), "n": (False, 0.9)}]
    rep = metrics.report(rows, preds)
    assert rep["q"]["accuracy"] == 0.5 and rep["n"]["accuracy"] == 1.0
    assert rep["q"]["n"] == 2


def test_temperature_is_one_when_already_calibrated():
    # 8 of 10 items are class 0 and the model says 0.8 every time: nothing to fix.
    probs = [[0.8, 0.2]] * 10
    gold = [0] * 8 + [1] * 2
    assert abs(metrics.fit_temperature(probs, gold) - 1.0) < 0.06


def test_temperature_softens_an_overconfident_model():
    # Says 0.8 but is right 6 of 10 times: T must grow (ln4 / ln1.5 = 3.4), and the top prob lands near 0.6.
    probs = [[0.8, 0.2]] * 10
    gold = [0] * 6 + [1] * 4
    t = metrics.fit_temperature(probs, gold)
    assert t > 3
    assert abs(metrics.apply_temperature(probs[0], t)[0] - 0.6) < 0.05


def test_precision_recall_by_hand():
    gold = [True, True, True, False, False]
    pred = [True, True, False, True, False]
    assert metrics.precision_recall(gold, pred) == (2 / 3, 2 / 3)


def test_from_raw_picks_top_label_and_applies_temperature():
    raw = [{"q": {"labels": ["a", "b"], "p": [0.9, 0.1]}}]
    assert metrics.from_raw(raw)[0]["q"] == ("a", 0.9)
    ans, conf = metrics.from_raw(raw, {"q": 5.0})[0]["q"]
    assert ans == "a" and 0.5 < conf < 0.65


def test_latin_only_drops_indic_scripts():
    # Scope is English and Hinglish in Roman script: rows with Devanagari or other Indic letters are out.
    rows = [{"state": "hello"}, {"state": "राइडर ने गाली दी"}, {"state": "Order #1: rider ne dhamki di"}, {"state": "வணக்கம்"}]
    assert metrics.latin_only(rows) == [0, 2]


def test_language_of_row():
    # Hindi = Devanagari letters; Hinglish = at least 2 common Roman-Hindi words; else English.
    assert metrics.language("राइडर ने गाली दी") == "hindi"
    assert metrics.language("Order #12: rider ne dhamki di, mera paisa wapas karo") == "hinglish"
    assert metrics.language("The food was cold and the rider was rude") == "english"
    assert metrics.language("Where is my order? Please ka") == "english"  # one Hindi word is not enough


def test_majority_skips_questions_absent_from_train():
    # Round 3 train has no refund rows (they run as code): the guess must skip them, not crash.
    train = [{"expected": {"q": "a"}}]
    test = [{"expected": {"q": "a", "refund": "approve"}}]
    assert metrics.majority_accuracy(train, test) == {"q": 1.0}


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok", name)
