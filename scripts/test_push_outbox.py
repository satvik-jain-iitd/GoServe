# Story #483 (epic E25): a push is queued by the database whenever an order reaches placed, ready, out_for_delivery or delivered, by any path
# (the apps, the dispatch, the city tick). One sender drains the queue. Every check ends in ROLLBACK (dev stays clean).
# Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_push_outbox.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

UID = "00000000-0000-0000-0000-0000000000e1"
RIDER = "00000000-0000-0000-0000-0000000000f1"
DISH = "(select id from menu_items order by price_paise limit 1)"
PLACE = f"select place_order('{UID}', 'key1', jsonb_build_array(jsonb_build_object('menu_item_id', {DISH}, 'qty', 1)), 'Flat 4')"
ORDER = f"(select id from orders where session_id='{UID}')"
SUB = f"insert into push_subscriptions (session_id, endpoint, p256dh, auth) values ('{UID}', 'https://web.push.apple.com/abc', 'k', 'a')"
RIDER_ROW = f"insert into riders (user_id, name) values ('{RIDER}', 'Asha')"


def step(*to):
    return [f"update orders set status='{s}'" + (f", rider_id='{RIDER}'" if s == "out_for_delivery" else "") + f" where session_id='{UID}'" for s in to]


def run(*stmts):
    return sql("begin; " + "; ".join(stmts) + "; rollback;")


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class PushOutbox(unittest.TestCase):
    def statuses(self, *stmts):
        r = run(*stmts, "select coalesce(array_agg(status order by id), '{}') as s from push_outbox")
        self.assertIsInstance(r, list, r)
        return r[-1]["s"]

    def test_placing_queues_one_push_when_the_customer_has_a_subscription(self):
        self.assertEqual(self.statuses(SUB, PLACE), ["placed"])

    def test_the_four_steps_are_queued_the_two_in_between_are_not(self):
        self.assertEqual(self.statuses(SUB, PLACE, RIDER_ROW, *step("accepted", "preparing", "ready", "out_for_delivery", "delivered")),
                         ["placed", "ready", "out_for_delivery", "delivered"])

    def test_a_status_change_made_by_a_plain_update_is_queued_too(self):
        # This is how the city tick moves an order: no app, no n8n webhook. It is the root cause of #483.
        self.assertEqual(self.statuses(SUB, PLACE, *step("accepted", "preparing", "ready"))[-1], "ready")

    def test_no_subscription_means_no_queue_row_but_a_trace_line_says_why(self):
        r = run(PLACE, "select (select count(*) from push_outbox) as q, (select result from order_trace where event='push_skipped') as why")
        self.assertEqual(r[-1], {"q": 0, "why": "no_subscription"}, r)

    def test_take_hands_each_row_out_once(self):
        r = run(SUB, PLACE, "select set_config('t.first', jsonb_array_length(push_outbox_take(10)->'rows')::text, true)",
                "select current_setting('t.first')::int as first, jsonb_array_length(push_outbox_take(10)->'rows') as again")
        self.assertEqual([r[-1]["first"], r[-1]["again"]], [1, 0], r)

    def test_take_answers_with_the_order_session_and_status(self):
        r = run(SUB, PLACE, f"select push_outbox_take(10)->'rows'->0 as row, {ORDER} as oid")
        row = r[-1]["row"]
        self.assertEqual((row["session_id"], row["status"], row["order_id"]), (UID, "placed", r[-1]["oid"]), r)

    def test_a_customer_cannot_read_or_change_the_queue(self):
        for who in ("set local role anon", "set local role authenticated"):
            self.assertIn("permission denied", str(run(who, "select * from push_outbox")), who)
            self.assertIn("permission denied", str(run(who, "select push_outbox_take(5)")), who)

    def test_the_picked_up_push_names_the_rider(self):
        sub = f"select push_latest('https://web.push.apple.com/abc')->>'body' as body"
        r = run(SUB, PLACE, RIDER_ROW, *step("accepted", "preparing", "ready", "out_for_delivery"), sub)
        self.assertEqual(r[-1]["body"], "Asha has picked up your order.", r)


    # Story #534: a row taken but never marked sent goes back after 2 minutes, at most 3 times, then it is dead-lettered with a trace row.
    AGE = "update push_outbox set taken_at = now() - interval '3 minutes'"

    def test_a_row_taken_a_moment_ago_is_not_offered_again(self):
        r = run(SUB, PLACE, "select push_outbox_take(10)", "select jsonb_array_length(push_outbox_take(10)->'rows') as soon")
        self.assertEqual(r[-1]["soon"], 0, r)

    def test_a_row_taken_but_not_sent_is_offered_again_after_two_minutes(self):
        r = run(SUB, PLACE, "select push_outbox_take(10)", self.AGE, "select jsonb_array_length(push_outbox_take(10)->'rows') as later")
        self.assertEqual(r[-1]["later"], 1, r)   # one statement sees one snapshot: the count of re-offers is read in the next test

    def test_each_reoffer_is_counted(self):
        r = run(SUB, PLACE, "select push_outbox_take(10)", self.AGE, "select push_outbox_take(10)", "select reoffers as n from push_outbox")
        self.assertEqual(r[-1]["n"], 1, r)

    def test_a_row_marked_sent_is_never_offered_again(self):
        r = run(SUB, PLACE, "select push_outbox_sent(array(select (x->>'id')::bigint from jsonb_array_elements(push_outbox_take(10)->'rows') x))",
                self.AGE, "select jsonb_array_length(push_outbox_take(10)->'rows') as later")
        self.assertEqual(r[-1]["later"], 0, r)

    def test_after_three_reoffers_the_row_is_dead_lettered_and_a_trace_row_says_so(self):
        again = ["select push_outbox_take(10)", self.AGE]
        r = run(SUB, PLACE, *again * 4, "select push_outbox_take(10)", "select (select dead_at is not null from push_outbox) as dead, "
                "(select count(*) from order_trace where event = 'push_dead') as traced, (select count(*) from push_outbox where dead_at is null and sent_at is null) as waiting")
        self.assertEqual((r[-1]["dead"], r[-1]["traced"], r[-1]["waiting"]), (True, 1, 0), r)

    def test_a_customer_cannot_mark_a_row_sent(self):
        for who in ("set local role anon", "set local role authenticated"):
            self.assertIn("permission denied", str(run(who, "select push_outbox_sent(array[1]::bigint[])")), who)


if __name__ == "__main__":
    unittest.main()
