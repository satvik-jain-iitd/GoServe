#!/usr/bin/env python3
"""Story #263 layer 2, test E9: the replay harness. These tests check the harness itself with a stub matcher (no database): the old rule, the rider and
order clock, the metrics, and that one seed gives one result. Run: python3 -m unittest scripts.test_dispatch_sim  (or discover in scripts/)."""
import os, sys, unittest
sys.path.insert(0, os.path.dirname(__file__))
import dispatch_sim as ds


def nearest_stub(state):
    """A stand-in for dispatch_match: every free rider takes the nearest due order. Same shape as the real answer."""
    out, used = [], set()
    for o in state["orders"]:
        if o["ready_at"] - state["now"] > 120:
            continue
        free = [r for r in state["riders"] if not r["load"] and r["id"] not in used and r["ping_age_s"] <= 90]
        if free:
            r = min(free, key=lambda r: ds.dist_m(r, o["k"]))
            used.add(r["id"]); out.append({"order_id": o["id"], "rider_id": r["id"], "stacked": False})
    return {"assignments": out, "zones": []}


class DispatchSim(unittest.TestCase):
    def test_old_rule_fewest_trips_then_nearest(self):
        riders = [{"id": "a", "lat": 28.55, "lng": 77.20, "trips": 3}, {"id": "b", "lat": 28.56, "lng": 77.20, "trips": 1}, {"id": "c", "lat": 28.551, "lng": 77.20, "trips": 1}]
        self.assertEqual(ds.old_rule_pick(riders, {"lat": 28.5505, "lng": 77.20})["id"], "c")   # c and b have 1 trip; c is nearer
        self.assertIsNone(ds.old_rule_pick([], {"lat": 28.55, "lng": 77.20}))

    def test_band_rule_nearest_first_trips_inside_the_band(self):
        k = {"lat": 28.55, "lng": 77.20}
        def r(i, north_m, trips): return {"id": i, "lat": 28.55 + north_m * 0.0009 / 100, "lng": 77.20, "trips": trips}
        self.assertEqual(ds.band_pick([r("a", 400, 9), r("b", 3000, 0)], k)["id"], "a")   # 400 m beats 3 km even with more trips
        self.assertEqual(ds.band_pick([r("a", 300, 5), r("b", 600, 1)], k)["id"], "b")    # 600 m is inside 300 m + 500 m: fewer trips wins
        self.assertEqual(ds.band_pick([r("a", 300, 5), r("b", 600, 1)], k, band=100)["id"], "a")   # the band is a tunable
        self.assertIsNone(ds.band_pick([], k))

    def test_band_arm_delivers_every_order(self):
        r = ds.run_sim(3, "band", None, hours=0.5)
        self.assertEqual(r["m"]["delivered"], r["m"]["orders"])

    def test_same_seed_same_result(self):
        a = ds.run_sim(7, "old", None, hours=0.5)
        b = ds.run_sim(7, "old", None, hours=0.5)
        self.assertEqual(a["m"], b["m"])
        self.assertNotEqual(ds.run_sim(8, "old", None, hours=0.5)["m"], a["m"])

    def test_every_order_is_delivered_and_waits_are_never_negative(self):
        for mode, matcher in (("old", None), ("new", nearest_stub)):
            r = ds.run_sim(3, mode, matcher, hours=0.5)
            self.assertGreater(r["m"]["orders"], 5)
            self.assertEqual(r["m"]["delivered"], r["m"]["orders"], mode)
            self.assertGreaterEqual(min(r["waits"]), 0)
            self.assertGreater(min(r["door"]), 5 * 60)   # nobody is delivered in under five minutes

    def test_metrics_percentiles(self):
        m = ds.metrics([0, 60, 120, 180, 600], [1200, 1500, 1800, 2000, 2800], [3, 3, 4, 2], 5, 5, 35 * 60)
        self.assertEqual((m["wait_p50"], m["wait_p90"]), (120, 432))   # linear between ranks: 180 + 0.6 x (600 - 180)
        self.assertEqual(m["door_p50"], 1800)
        self.assertEqual(m["late_share"], 0.2)   # one of five came later than the promise plus 10 minutes
        self.assertEqual(m["trip_spread"], 2)

    def test_decision_rule(self):
        base = {"wait_p50": 600, "door_p90": 2400}
        better = {"wait_p50": 380, "door_p90": 2440}
        self.assertTrue(ds.ship_rule([(base, better)] * 3))
        self.assertFalse(ds.ship_rule([(base, better), (base, {"wait_p50": 380, "door_p90": 2500}), (base, better)]))   # P90 up more than 60 s on one seed
        self.assertFalse(ds.ship_rule([(base, {"wait_p50": 450, "door_p90": 2400})] * 3))   # wait down only 25 %


if __name__ == "__main__":
    unittest.main()
