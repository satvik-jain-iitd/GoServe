# Story #1067: the web push leaves n8n. A new outbox row asks the Edge Function at once (push_outbox_fire), the function reads one row with its subscriptions and words (push_web_job_v2),
# forgets dead ones (push_web_forget_v2) and reports the result (push_web_done_v2: the row is sent, a push_sent trace line ends the clock that started at push_queued).
# Every check ends in ROLLBACK. The migration runs inside each transaction; SKIP_MIG=1 runs against the database as it is (the red run).
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_web_push_now.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql, migration_inside

MIG = migration_inside(["20261108190000_web_push_now.sql", "20261108210000_web_push_done_note.sql"], "to_regproc('public.push_web_job_v2') is not null and exists (select 1 from pg_proc where proname = 'push_web_done_v2' and pronargs = 4)")   # empty once dev has both applied
UID = "00000000-0000-0000-0000-0000000000e7"
DISH = "(select id from menu_items order by price_paise limit 1)"
PLACE = f"select place_order('{UID}', 'key7', jsonb_build_array(jsonb_build_object('menu_item_id', {DISH}, 'qty', 1)), 'Flat 4')"
SUBS = [f"insert into push_subscriptions (session_id, endpoint, p256dh, auth) values ('{UID}', 'https://web.push.example/a', 'k1', 'a1')",
        f"insert into push_subscriptions (session_id, endpoint, p256dh, auth) values ('{UID}', 'https://web.push.example/b', 'k2', 'a2')"]
ROW = f"(select id from push_outbox where session_id = '{UID}' order by id limit 1)"


def run(*stmts):
    r = sql("begin; delete from push_outbox; " + MIG + "; " + "; ".join(stmts) + "; rollback;")
    assert isinstance(r, list), r
    return r[-1]


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class WebPushNow(unittest.TestCase):
    def test_s1_placing_an_order_still_works_with_no_vault_secrets_and_the_row_is_queued(self):
        r = run(*SUBS, PLACE, f"select count(*)::int as n from push_outbox where session_id = '{UID}' and status = 'placed'")
        self.assertEqual(r["n"], 1)

    def test_s2_the_job_gives_every_subscription_with_the_words_and_marks_the_row_taken(self):
        r = run(*SUBS, PLACE, f"create temp table jj as select push_web_job_v2({ROW}) as j", f"select (select j from jj) as j, (select taken_at is not null from push_outbox where id = {ROW}) as taken")
        j = r["j"]
        self.assertEqual([j["ok"], j["done"], j["status"]], [True, False, "placed"])
        self.assertEqual([s["endpoint"] for s in j["subscriptions"]], ["https://web.push.example/a", "https://web.push.example/b"])
        self.assertEqual(j["subscriptions"][0]["message"]["body"], "Your order is placed.")
        self.assertEqual([j["subscriptions"][0]["p256dh"], j["subscriptions"][0]["auth"]], ["k1", "a1"])
        self.assertTrue(r["taken"])

    def test_s3_a_row_already_sent_or_unknown_is_done(self):
        r = run(*SUBS, PLACE, f"update push_outbox set sent_at = now() where id = {ROW}", f"select push_web_job_v2({ROW}) as j")
        self.assertEqual([r["j"]["done"], r["j"]["subscriptions"]], [True, []])
        self.assertTrue(run("select push_web_job_v2(-1) as j")["j"]["done"])

    def test_s3b_function_and_drain_race_on_one_row_exactly_one_takes_it(self):
        # the claim is one UPDATE guarded by taken_at is null, from either side: whoever comes second gets nothing
        a = run(*SUBS, PLACE, f"create temp table jj as select push_web_job_v2({ROW}) as j",
                "create temp table tt as select push_outbox_take(20) as t", "select (select j from jj) as j, (select t from tt) as t")
        self.assertFalse(a["j"]["done"])
        self.assertEqual(a["t"]["rows"], [])
        b = run(*SUBS, PLACE, "create temp table tt as select push_outbox_take(20) as t", f"create temp table jj as select push_web_job_v2({ROW}) as j", "select (select j from jj) as j, (select t from tt) as t")
        self.assertEqual(len(b["t"]["rows"]), 1)
        self.assertTrue(b["j"]["done"])

    def test_s3c_the_retry_asks_again_a_stalled_row_three_times_then_it_is_dead(self):
        r = run(*SUBS, PLACE, f"update push_outbox set taken_at = now() - interval '2 minutes' where id = {ROW}", "create temp table nn as select push_web_retry() as n",
                f"select (select n from nn) as n, (select reoffers from push_outbox where id = {ROW}) as re, (select taken_at is null from push_outbox where id = {ROW}) as free")
        self.assertEqual([r["n"], r["re"], r["free"]], [1, 1, True])
        d = run(*SUBS, PLACE, f"update push_outbox set taken_at = now() - interval '2 minutes', reoffers = 3 where id = {ROW}", "select push_web_retry()",
                f"select (select dead_at is not null from push_outbox where id = {ROW}) as dead")
        self.assertTrue(d["dead"])
        old = run(*SUBS, PLACE, f"update push_outbox set created_at = now() - interval '11 minutes', taken_at = null where id = {ROW}", "select push_web_retry()",
                  f"select (select dead_at is not null from push_outbox where id = {ROW}) as dead")
        self.assertTrue(old["dead"])
        lost = run(*SUBS, PLACE, f"update push_outbox set created_at = now() - interval '40 seconds' where id = {ROW}", "create temp table nn as select push_web_retry() as n",
                   f"select (select n from nn) as n, (select reoffers from push_outbox where id = {ROW}) as re")
        self.assertEqual([lost["n"], lost["re"]], [1, 1])   # never claimed for 30 s: the pg_net call was lost, ask again
        fresh = run(*SUBS, PLACE, "create temp table nn as select push_web_retry() as n", "select (select n from nn) as n")
        self.assertEqual(fresh["n"], 0)   # a new row is still on its way
        done = run(*SUBS, PLACE, f"update push_outbox set sent_at = now(), taken_at = now() - interval '2 minutes' where id = {ROW}", "create temp table nn as select push_web_retry() as n", "select (select n from nn) as n")
        self.assertEqual(done["n"], 0)

    def test_s4_done_marks_the_row_sent_and_writes_push_sent_after_push_queued(self):
        r = run(*SUBS, PLACE, f"select push_web_done_v2({ROW}, 2, 0)",
                f"select (select sent_at is not null from push_outbox where id = {ROW}) as sent, "
                f"(select array_agg(event order by at) from order_trace where order_id = (select order_id from push_outbox where id = {ROW}) and event in ('push_queued', 'push_sent')) as ev")
        self.assertTrue(r["sent"])
        self.assertEqual(r["ev"], ["push_queued", "push_sent"])

    def test_s5_a_send_where_everything_failed_keeps_the_row_for_the_retry(self):
        r = run(*SUBS, PLACE, f"select push_web_done_v2({ROW}, 0, 2)",
                f"select (select sent_at is null from push_outbox where id = {ROW}) as open, "
                f"(select count(*)::int from order_trace where event = 'push_failed' and order_id = (select order_id from push_outbox where id = {ROW})) as failed")
        self.assertEqual([r["open"], r["failed"]], [True, 1])

    def test_s5b_a_failure_note_goes_into_the_trace_line_and_is_cut_at_200_characters(self):
        r = run(*SUBS, PLACE, f"select push_web_done_v2({ROW}, 0, 1, 'status 403')", f"select (select detail->>'text' from order_trace where event = 'push_failed' and order_id = (select order_id from push_outbox where id = {ROW})) as t")
        self.assertEqual(r["t"], "web: 1 failed, row kept for retry (status 403)")
        r = run(*SUBS, PLACE, f"select push_web_done_v2({ROW}, 0, 1, repeat('x', 500))", f"select (select length(detail->>'text') from order_trace where event = 'push_failed' and order_id = (select order_id from push_outbox where id = {ROW})) as n")
        self.assertEqual(r["n"], 200)

    def test_s6_forget_removes_only_that_subscription(self):
        r = run(*SUBS, "select push_web_forget_v2('https://web.push.example/a')",
                f"select array_agg(endpoint) as left from push_subscriptions where session_id = '{UID}'")
        self.assertEqual(r["left"], ["https://web.push.example/b"])

    def test_s7_only_the_service_may_call_them(self):
        r = sql("select has_function_privilege('anon', 'push_web_job_v2(bigint)', 'execute') or has_function_privilege('authenticated', 'push_web_done_v2(bigint,int,int,text)', 'execute') or has_function_privilege('anon', 'push_web_forget_v2(text)', 'execute') as open" if not MIG else
                "begin; " + MIG + "; select has_function_privilege('anon', 'push_web_job_v2(bigint)', 'execute') or has_function_privilege('authenticated', 'push_web_done_v2(bigint,int,int,text)', 'execute') or has_function_privilege('anon', 'push_web_forget_v2(text)', 'execute') as open; rollback;")
        row = r[-1] if isinstance(r, list) else r
        self.assertFalse(row["open"], r)


if __name__ == "__main__":
    unittest.main()
