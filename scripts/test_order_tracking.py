# Story #352 (E27, plan v2 B.16): the live tracking feed. Scenario: Given an order on the way, when the rider moves, then the channel carries status,
# rider position and a new ETA.
# The channel is Supabase Realtime on one table, order_tracking, one row per order. Row level security is the gate: only the customer who placed the
# order reads its row, so a client subscribes to postgres_changes with the filter order_id=eq.<id>. The row is kept by the database: a trigger on orders
# (status, rider) and rider_ping (position). ETA = minutes at 250 m a minute (assumption A85); the place is the pin's drop point (pin_points).
# Every check ends in ROLLBACK (dev stays clean). Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_order_tracking.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

K = "00000000-0000-0000-0000-0000000000b1"
O = "00000000-0000-0000-0000-0000000000f1"
CUST, RIDER, OTHER = [f"00000000-0000-0000-0000-0000000000a{i}" for i in (1, 2, 3)]
PIN = "119999"
SETUP = [
    f"insert into auth.users (id) values ('{CUST}'), ('{RIDER}'), ('{OTHER}')",
    f"insert into pin_points (pin, lat, lng) values ('{PIN}', 28.60, 77.20)",   # where the food is dropped
    f"insert into kitchens (id, name, pin_codes, lat, lng) values ('{K}', 'Test', array['{PIN}'], 28.59, 77.20)",   # 1.1 km south of the pin point
    f"insert into riders (user_id, online, lat, lng) values ('{RIDER}', true, 28.59, 77.20)",
    "create temp table res (i serial, r jsonb)", "grant all on res to public", "grant all on res_i_seq to public",
]


def who(uid):
    return ["reset role", "set local role authenticated", f"select set_config('request.jwt.claims', '{{\"sub\":\"{uid}\",\"role\":\"authenticated\"}}', true)"]


def make_order(status="placed", rider=True):
    s = [f"insert into orders (id, kitchen_id, session_id, client_order_key, items, total_paise, address, pin_code) values ('{O}', '{K}', '{CUST}', 'k', '[]', 100, 'x', '{PIN}')"]
    for st in ["accepted", "preparing", "ready", "out_for_delivery", "delivered"]:
        if status == "placed":
            break
        if st == "out_for_delivery" and rider:
            s.append(f"update orders set rider_id = '{RIDER}' where id = '{O}'")
        s.append(f"update orders set status = '{st}' where id = '{O}'")
        if st == status:
            break
    return s


def ping(lat):
    return who(RIDER) + [f"select rider_ping({lat}, 77.20)"]


def run(*steps, final=""):
    flat = [s for st in steps for s in (st if isinstance(st, list) else [st])]
    r = sql("begin; " + "; ".join(SETUP + flat + ["reset role", f"select {final}"]) + "; rollback;")
    assert isinstance(r, list), r
    return r[-1]


ROW = f"(select row_to_json(t) from (select status, rider_lat, rider_lng, eta_min from order_tracking where order_id = '{O}') t) as row"
COUNT = f"(select count(*) from order_tracking where order_id = '{O}') as n"


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class OrderTracking(unittest.TestCase):
    def test_a_placed_order_has_a_tracking_row_with_no_rider_and_no_eta(self):
        r = run(make_order(), final=ROW)
        self.assertEqual(r["row"], {"status": "placed", "rider_lat": None, "rider_lng": None, "eta_min": None}, r)

    def test_when_the_rider_moves_the_row_carries_status_position_and_a_new_eta(self):
        # the scenario: out for delivery, the rider is 1.1 km from the drop point; then 330 m
        r = run(make_order("out_for_delivery"), final=ROW)
        self.assertEqual((r["row"]["status"], r["row"]["rider_lat"], r["row"]["eta_min"]), ("out_for_delivery", 28.59, 5), r)
        r = run(make_order("out_for_delivery"), ping(28.597), final=ROW)
        self.assertEqual((r["row"]["rider_lat"], r["row"]["rider_lng"], r["row"]["eta_min"]), (28.597, 77.2, 2), r)

    def test_before_pickup_the_eta_counts_the_ride_to_the_kitchen_and_on_to_the_drop_point(self):
        r = run(make_order("ready"), f"update orders set rider_id = '{RIDER}' where id = '{O}'", final=ROW)
        self.assertEqual((r["row"]["status"], r["row"]["eta_min"]), ("ready", 5), r)   # the rider is at the kitchen: 0 m + 1.1 km
        far = run(make_order("ready"), f"update orders set rider_id = '{RIDER}' where id = '{O}'", ping(28.58), final=ROW)
        self.assertEqual(far["row"]["eta_min"], 9, far)   # 1.1 km to the kitchen + 1.1 km on = 2.2 km

    def test_a_delivered_or_cancelled_order_has_no_eta(self):
        self.assertEqual(run(make_order("delivered"), final=ROW)["row"]["eta_min"], None)
        cancelled = run(make_order(), f"update orders set status = 'cancelled', cancel_reason = 'x' where id = '{O}'", final=ROW)
        self.assertEqual((cancelled["row"]["status"], cancelled["row"]["eta_min"]), ("cancelled", None))

    def test_another_riders_ping_does_not_touch_this_order(self):
        r = run(make_order("out_for_delivery"), f"insert into riders (user_id, online, lat, lng) values ('{OTHER}', true, 28.0, 77.0)",
                who(OTHER) + ["select rider_ping(28.61, 77.20)"], final=ROW)
        self.assertEqual(r["row"]["rider_lat"], 28.59, r)

    def test_only_the_customer_who_placed_it_can_read_the_row(self):
        mine = run(make_order("out_for_delivery"), who(CUST), final=f"(select count(*) from order_tracking where order_id = '{O}') as n")
        self.assertEqual(mine["n"], 1)
        stranger = sql("begin; " + "; ".join(SETUP + make_order("out_for_delivery") + who(OTHER) + [f"select count(*) as n from order_tracking where order_id = '{O}'"]) + "; rollback;")
        self.assertEqual(stranger[-1], {"n": 0}, stranger)
        anon = sql("begin; " + "; ".join(SETUP + make_order() + ["reset role", "set local role anon", "select count(*) from order_tracking"]) + "; rollback;")
        self.assertIn("permission denied", str(anon))

    def test_nobody_can_write_the_row_by_hand(self):
        for stmt in (f"update order_tracking set eta_min = 1 where order_id = '{O}'", f"delete from order_tracking where order_id = '{O}'",
                     f"insert into order_tracking (order_id, session_id, status) values ('{OTHER}', '{CUST}', 'placed')"):
            w = sql("begin; " + "; ".join(SETUP + make_order("out_for_delivery") + who(CUST) + [stmt]) + "; rollback;")
            self.assertIn("permission denied", str(w), stmt)

    def test_the_table_is_on_the_realtime_publication(self):
        r = sql("select count(*) as n from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'order_tracking'")
        self.assertEqual(r, [{"n": 1}], r)


if __name__ == "__main__":
    unittest.main()
