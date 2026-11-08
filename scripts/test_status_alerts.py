# Story #1099: alerts for accepted, cancelled and declined. The database queues a push when the kitchen accepts, when an order is cancelled by the kitchen, admin or rider
# (not by the customer), and a kitchen decline says its reason in the words. Every check ends in ROLLBACK. SKIP_MIG=1 is the red run.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_status_alerts.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql, migration_inside

MIG = migration_inside(["20261109100000_status_alerts.sql"], "to_regproc('public.push_decline_words') is not null")   # empty once dev has it
UID = "00000000-0000-0000-0000-0000000000e9"
K = "00000000-0000-0000-0000-0000000000b9"
PLACE = (f"insert into kitchens (id, name, pin_codes, lat, lng) values ('{K}', 'Test', array['110016'], 28.5494, 77.2001); "
         f"insert into orders (kitchen_id, session_id, client_order_key, items, total_paise, address) values ('{K}', '{UID}', 'key9', '[]', 100, 'Flat 4')")   # direct insert: place_order refuses while the kitchen is closed
SUB = f"insert into push_subscriptions (session_id, endpoint, p256dh, auth) values ('{UID}', 'https://web.push.example/z', 'k1', 'a1')"
ORDER = f"(select id from orders where session_id = '{UID}')"
QUEUED = lambda s: f"(select count(*)::int from push_outbox where session_id = '{UID}' and status = '{s}')"
WORDS = "push_latest('https://web.push.example/z') ->> 'body'"


def run(*stmts):
    r = sql("begin; delete from push_outbox; " + MIG + "; " + "; ".join(stmts) + "; rollback;")
    assert isinstance(r, list), r
    return r[-1]


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class StatusAlerts(unittest.TestCase):
    def test_s1_accepted_queues_one_push(self):
        r = run(SUB, PLACE, f"update orders set status = 'accepted' where id = {ORDER}", f"select {QUEUED('accepted')} as n")
        self.assertEqual(r["n"], 1)

    def test_s2_a_kitchen_decline_queues_one_push_and_says_why(self):
        r = run(SUB, PLACE, f"update orders set status = 'cancelled', cancel_reason = 'We are out of paneer tonight', cancelled_by = 'kitchen' where id = {ORDER}",
                f"select {QUEUED('cancelled')} as n, {WORDS} as body")
        self.assertEqual(r["n"], 1)
        self.assertEqual(r["body"], "The kitchen declined your order: We are out of paneer tonight")

    def test_s3_the_customers_own_cancel_queues_nothing(self):
        r = run(SUB, PLACE, f"update orders set status = 'cancelled', cancelled_by = 'customer' where id = {ORDER}", f"select {QUEUED('cancelled')} as n")
        self.assertEqual(r["n"], 0)

    def test_s4_an_admin_or_rider_cancel_queues_one_push_with_the_plain_words(self):
        for by, why in (("admin", "Wrong address"), ("rider", "refused_at_door")):
            r = run(SUB, PLACE, f"update orders set status = 'cancelled', cancel_reason = '{why}', cancelled_by = '{by}' where id = {ORDER}", f"select {QUEUED('cancelled')} as n, {WORDS} as body")
            self.assertEqual((r["n"], r["body"]), (1, "Your order was cancelled."), by)

    def test_s5_a_long_reason_is_cut_at_120_characters(self):
        long = "x" * 300
        r = run(SUB, PLACE, f"update orders set status = 'cancelled', cancel_reason = '{long}', cancelled_by = 'kitchen' where id = {ORDER}", f"select {WORDS} as body")
        self.assertEqual(r["body"], "The kitchen declined your order: " + "x" * 120)

    def test_s6_no_subscription_no_row_and_the_trace_says_why(self):
        r = run(PLACE, f"update orders set status = 'accepted' where id = {ORDER}",
                f"select {QUEUED('accepted')} as n, (select count(*)::int from order_trace where order_id = {ORDER} and event = 'push_skipped' and result = 'no_subscription') as skipped")
        self.assertEqual((r["n"], r["skipped"]), (0, 2))   # placed and accepted both skip

    def test_s7_the_old_statuses_still_queue(self):
        r = run(SUB, PLACE, f"select {QUEUED('placed')} as n")
        self.assertEqual(r["n"], 1)


if __name__ == "__main__":
    unittest.main()
