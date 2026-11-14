# Story 1497: the tracking row is built from the order, and its rider time is the time of the rider's ping.
# Scenario: Given the rider's last ping is 40 minutes old, when the order's row is written again, then rider_at is 40 minutes old and updated_at is now.
# Scenario: Given an order with its own drop point, then the row carries that point; given an order with none, the row has no point (no postal code fallback).
# Every check ends in ROLLBACK and runs the migration inside the transaction, so it holds before and after the migration is on dev.
# Run as test_order_tracking.py, with SKIP_MIG=1 (its own migration is already on dev). Needs SUPABASE_ACCESS_TOKEN; skipped without it.
import os, unittest
import test_order_tracking as t

MIG = open(os.path.join(t.HERE, "..", "supabase", "migrations", "20261114150000_tracking_from_the_order.sql")).read()
ROW = f"(select row_to_json(x) from (select rider_lat, rider_at is not null as has_time, round(extract(epoch from updated_at - rider_at) / 60) as age_min, drop_lat, drop_lng from order_tracking where order_id = '{t.O}') x) as row"


def run(*steps):
    return t.run([MIG], *steps, final=ROW)["row"]


@unittest.skipUnless(t.TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class TrackingFromTheOrder(unittest.TestCase):
    def test_a_place_that_was_never_pinged_has_no_time(self):
        r = run(t.make_order("out_for_delivery"))   # the rider row has a place from the setup, and no ping
        self.assertEqual((r["rider_lat"], r["has_time"]), (28.59, False), r)

    def test_a_ping_stamps_the_time_of_the_place(self):
        r = run(t.make_order("out_for_delivery"), t.ping(28.597))
        self.assertEqual((r["rider_lat"], r["has_time"], r["age_min"]), (28.597, True, 0), r)

    def test_writing_the_row_again_keeps_the_old_ping_time(self):
        r = run(t.make_order("ready"), f"update orders set rider_id = '{t.RIDER}' where id = '{t.O}'", f"update riders set located_at = now() - interval '40 minutes' where user_id = '{t.RIDER}'",
                f"update orders set status = 'out_for_delivery' where id = '{t.O}'")
        self.assertEqual((r["has_time"], r["age_min"]), (True, 40), r)

    def test_the_row_carries_the_orders_own_drop_point(self):
        r = run(t.make_order("out_for_delivery"), f"update orders set drop_lat = 28.61, drop_lng = 77.21 where id = '{t.O}'", t.ping(28.597))
        self.assertEqual((r["drop_lat"], r["drop_lng"]), (28.61, 77.21), r)

    def test_an_order_with_no_drop_point_has_none_on_the_row_even_when_its_postal_code_has_one(self):
        r = run(t.make_order("out_for_delivery"), t.ping(28.597))
        self.assertEqual((r["drop_lat"], r["drop_lng"]), (None, None), r)


if __name__ == "__main__":
    unittest.main()
