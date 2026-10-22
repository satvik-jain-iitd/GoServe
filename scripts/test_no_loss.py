"""Story S-M2 (#118): the count rules of the no-loss proof. No network."""
import unittest
from no_loss_check import verify

CHAIN = ["order.placed", "order.accepted", "order.preparing", "order.ready"]


def ev(oid, names):
    return [{"order_id": oid, "event": n} for n in names]


class Verify(unittest.TestCase):
    def good(self, n=3):
        orders = [{"id": f"o{i}", "client_order_key": f"k{i}"} for i in range(n)]
        events = [e for o in orders for e in ev(o["id"], CHAIN)]
        return orders, events

    def test_all_good(self):
        o, e = self.good()
        self.assertEqual(verify(o, e, sent=3), {"orders": 3, "duplicates": 0, "chains_ok": 3, "lost": 0})

    def test_a_double_key_is_a_duplicate(self):
        o, e = self.good()
        o.append({"id": "x", "client_order_key": "k0"})
        self.assertEqual(verify(o, e, sent=3)["duplicates"], 1)

    def test_a_missing_order_is_lost(self):
        o, e = self.good()
        self.assertEqual(verify(o[:2], e, sent=3)["lost"], 1)

    def test_a_repeated_event_breaks_the_chain(self):
        o, e = self.good()
        e += ev("o1", ["order.ready"])
        self.assertEqual(verify(o, e, sent=3)["chains_ok"], 2)

    def test_events_out_of_order_break_the_chain(self):
        o, _ = self.good(1)
        e = ev("o0", ["order.placed", "order.preparing", "order.accepted", "order.ready"])
        self.assertEqual(verify(o, e, sent=1)["chains_ok"], 0)


if __name__ == "__main__":
    unittest.main()
