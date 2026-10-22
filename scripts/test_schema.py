# Story #43, S1-S3: schema on goserve-dev. Runs each check inside BEGIN..ROLLBACK, so dev stays clean.
# Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped when it is not set (CI has none).
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_schema.py
import json, os, unittest, urllib.error, urllib.request

REF = "tmxyizmkpwwfyazvrfhw"  # goserve-dev
TOKEN = os.environ.get("SUPABASE_ACCESS_TOKEN")


def sql(query):
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{REF}/database/query",
        data=json.dumps({"query": query}).encode(),
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json", "User-Agent": "goserve-tests"},
    )
    try:
        return json.load(urllib.request.urlopen(req))
    except urllib.error.HTTPError as e:
        return {"error": e.read().decode()}


SEED = "insert into kitchens (id, name) values ('00000000-0000-0000-0000-000000000001', 'Test') ;"
ORDER = "insert into orders (id, kitchen_id, client_order_key, items, total_paise, address) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000001', 'k1', '[]', 100, 'x')"

A1 = "'00000000-0000-0000-0000-0000000000a1'"
TO_READY = " ".join(f"update orders set status='{x}' where id={A1};" for x in ("accepted", "preparing", "ready"))


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class Schema(unittest.TestCase):
    def test_s1_tables_exist_with_kitchen_id_and_session_id(self):
        r = sql("""select table_name from information_schema.columns where table_schema='public'
                   and column_name in ('kitchen_id','session_id') group by table_name
                   having count(*)=2 or table_name='kitchens' order by 1""")
        names = {row["table_name"] for row in r} if isinstance(r, list) else set()
        self.assertEqual(names, {"kitchens", "menu_items", "orders", "order_events", "decision_log", "run_log", "params"}, r)

    def test_s2_illegal_step_is_rejected_by_the_database(self):
        r = sql(f"begin; {SEED} {ORDER}; update orders set status='ready' where id='00000000-0000-0000-0000-0000000000a1'; rollback;")
        self.assertIn("error", r)  # placed -> ready skips steps
        r = sql(f"begin; {SEED} {ORDER}; update orders set status='accepted' where id='00000000-0000-0000-0000-0000000000a1'; update orders set status='preparing' where id='00000000-0000-0000-0000-0000000000a1'; "
                f"update orders set status='ready' where id='00000000-0000-0000-0000-0000000000a1'; update orders set status='placed' where id='00000000-0000-0000-0000-0000000000a1'; rollback;")
        self.assertIn("error", r)  # ready -> placed goes back
        r = sql(f"begin; {SEED} {ORDER}; update orders set status='accepted' where id='00000000-0000-0000-0000-0000000000a1'; update orders set status='preparing' where id='00000000-0000-0000-0000-0000000000a1'; "
                f"update orders set status='ready' where id='00000000-0000-0000-0000-0000000000a1'; update orders set status='out_for_delivery' where id='00000000-0000-0000-0000-0000000000a1'; update orders set status='delivered' where id='00000000-0000-0000-0000-0000000000a1'; rollback;")
        self.assertNotIn("error", r)  # the legal path works

    def test_s3_retry_makes_one_order(self):
        r = sql(f"begin; {SEED} {ORDER}; {ORDER.replace('0000000000a1', '0000000000a2')} on conflict (session_id, client_order_key) do nothing; "
                f"select count(*) as n from orders; rollback;")
        self.assertEqual(r[-1]["n"], 1, r) if isinstance(r, list) else self.fail(r)

    # Story S-C (#95): delivered by hand, paid by cash (migration 0009)
    def test_s7_paid_by_only_takes_cash(self):
        r = sql(f"begin; {SEED} {ORDER}; update orders set paid_by='card' where id={A1}; rollback;")
        self.assertIn("error", r)
        r = sql(f"begin; {SEED} {ORDER}; update orders set paid_by='cash' where id={A1}; rollback;")
        self.assertNotIn("error", r)

    def test_s8_a_second_tap_on_the_same_step_is_refused_as_already_done(self):
        r = sql(f"begin; {SEED} {ORDER}; select change_status({A1}, 'demo', 'accepted', 'kitchen'); select change_status({A1}, 'demo', 'accepted', 'kitchen'); rollback;")
        self.assertIn("already_done", json.dumps(r))
        r = sql(f"begin; {SEED} {ORDER}; select count(*) as n from (select change_status({A1}, 'demo', 'accepted', 'kitchen')) x; rollback;")
        self.assertNotIn("error", r)

    def test_s9_yes_closes_a_ready_order_as_delivered_and_cash_and_a_second_yes_changes_nothing(self):
        r = sql(f"begin; {SEED} {ORDER}; {TO_READY} select confirm_delivery({A1}, 'demo'); "
                f"select jsonb_build_object('second', confirm_delivery({A1}, 'demo'), 'status', (select status from orders where id={A1}), "
                f"'paid_by', (select paid_by from orders where id={A1}), 'events', (select jsonb_agg(event order by id) from order_events where order_id={A1}), "
                f"'actors', (select jsonb_agg(distinct actor) from order_events where order_id={A1} and event like 'order.c%')) as out; rollback;")
        self.assertIsInstance(r, list, r)
        out = r[-1]["out"]
        self.assertEqual((out["status"], out["paid_by"]), ("delivered", "cash"))
        self.assertTrue(out["second"]["already_done"])
        self.assertEqual(out["events"][-3:], ["order.picked_up", "order.delivered", "order.confirmed"])
        self.assertEqual(out["events"].count("order.confirmed"), 1)
        self.assertEqual(out["actors"], ["customer"])

    def test_s10_yes_before_the_kitchen_is_ready_is_refused(self):
        r = sql(f"begin; {SEED} {ORDER}; select confirm_delivery({A1}, 'demo'); rollback;")
        self.assertIn("illegal status step", json.dumps(r))
        r = sql(f"begin; {SEED} {ORDER}; select confirm_delivery({A1}, 'other-session'); rollback;")
        self.assertIn("order_not_found", json.dumps(r))

    def test_s11_yes_after_the_rider_delivered_records_cash_once(self):
        r = sql(f"begin; {SEED} {ORDER}; {TO_READY} update orders set status='out_for_delivery' where id={A1}; update orders set status='delivered' where id={A1}; "
                f"select confirm_delivery({A1}, 'demo'); "
                f"select jsonb_build_object('second', confirm_delivery({A1}, 'demo'), 'paid_by', (select paid_by from orders where id={A1}), "
                f"'confirmed', (select count(*) from order_events where order_id={A1} and event = 'order.confirmed')) as out; rollback;")
        self.assertIsInstance(r, list, r)
        out = r[-1]["out"]
        self.assertEqual(out["paid_by"], "cash")
        self.assertEqual(out["confirmed"], 1)
        self.assertTrue(out["second"]["already_done"])


if __name__ == "__main__":
    unittest.main()
