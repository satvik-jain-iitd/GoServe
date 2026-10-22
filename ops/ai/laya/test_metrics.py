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


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok", name)
