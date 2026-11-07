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
    # Dev holds real queue rows; the checks must see only their own (the delete is rolled back with everything else).
    return sql("begin; delete from push_outbox; " + "; ".join(stmts) + "; rollback;")


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class PushOutbox(unittest.TestCase):
    def statuses(self, *stmts):
        r = run(*stmts, f"select coalesce(array_agg(status order by id), '{{}}') as s from push_outbox where session_id = '{UID}'")
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
        r = run(PLACE, f"select (select count(*) from push_outbox where session_id = '{UID}') as q, (select result from order_trace where event='push_skipped') as why")
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

    # Story #920: a restart never fires yesterday's pushes, the phone gets the order id as its tag, and the daily check sees a queue that waits too long.
    OLD = "update push_outbox set created_at = now() - interval '11 minutes'"

    def test_a_row_older_than_10_minutes_is_dead_as_stale_and_never_handed_out(self):
        r = run(SUB, PLACE, self.OLD, "select jsonb_array_length(push_outbox_take(10)->'rows') as handed",
                "select (select dead_at is not null from push_outbox) as dead, (select reoffers from push_outbox) as reoffers, (select taken_at is null from push_outbox) as untaken, "
                "(select (detail::text like '%stale%') from order_trace where event = 'push_dead') as why")
        self.assertEqual(r[-1], {"dead": True, "reoffers": 0, "untaken": True, "why": True}, r)

    def test_a_row_of_9_minutes_is_still_sent(self):
        r = run(SUB, PLACE, "update push_outbox set created_at = now() - interval '9 minutes'", "select jsonb_array_length(push_outbox_take(10)->'rows') as handed")
        self.assertEqual(r[-1]["handed"], 1, r)

    def test_the_latest_push_carries_the_order_id_for_the_phone_tag(self):
        r = run(SUB, PLACE, f"select push_latest('https://web.push.apple.com/abc')->>'order_id' as oid, {ORDER}::text as want")
        self.assertEqual(r[-1]["oid"], r[-1]["want"], r)

    def test_the_daily_numbers_say_how_long_the_oldest_waiting_push_has_waited(self):
        r = run(SUB, PLACE, "update push_outbox set created_at = now() - interval '5 minutes'", "select (health_numbers()->>'push_wait_s')::int as wait")
        self.assertTrue(299 <= r[-1]["wait"] <= 330, r)

    def test_an_empty_queue_has_no_wait(self):
        r = run("select health_numbers() ? 'push_wait_s' as has, health_numbers()->'push_wait_s' = 'null'::jsonb as isnull")
        self.assertEqual(r[-1], {"has": True, "isnull": True}, r)


    # Story #922: the rider's Arriving tap (an event, not a status) queues one push; a second one is still one push; the phone is told the rider is at the door.
    ARRIVING = f"select rider_event({ORDER}, '{UID}', 'order.arriving', 'rider')"
    ARRIVING_ROW = f"insert into order_events (order_id, kitchen_id, session_id, event, actor) select id, kitchen_id, session_id, 'order.arriving', 'rider' from orders where session_id = '{UID}'"
    ROAD = ["accepted", "preparing", "ready", "out_for_delivery"]

    def test_arriving_queues_one_push(self):
        self.assertEqual(self.statuses(SUB, PLACE, RIDER_ROW, *step(*self.ROAD), self.ARRIVING)[-1], "arriving")

    def test_the_same_event_twice_is_still_one_push(self):
        s = self.statuses(SUB, PLACE, RIDER_ROW, *step(*self.ROAD), self.ARRIVING_ROW, self.ARRIVING_ROW)
        self.assertEqual(s.count("arriving"), 1, s)

    def test_no_subscription_means_no_arriving_push(self):
        r = run(PLACE, RIDER_ROW, *step(*self.ROAD), self.ARRIVING, f"select count(*) as n from push_outbox where session_id = '{UID}'")
        self.assertEqual(r[-1]["n"], 0, r)

    def test_the_phone_is_told_the_rider_is_at_the_door(self):
        r = run(SUB, PLACE, RIDER_ROW, *step(*self.ROAD), self.ARRIVING, "select push_latest('https://web.push.apple.com/abc')->>'body' as body")
        self.assertEqual(r[-1]["body"], "Your rider is at your door.", r)

    def test_before_arriving_the_phone_still_says_picked_up(self):
        r = run(SUB, PLACE, RIDER_ROW, *step(*self.ROAD), "select push_latest('https://web.push.apple.com/abc')->>'body' as body")
        self.assertEqual(r[-1]["body"], "Asha has picked up your order.", r)


if __name__ == "__main__":
    unittest.main()
