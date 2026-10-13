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
        r = sql(f"begin; {SEED} {ORDER}; update orders set status='accepted'; update orders set status='preparing'; "
                f"update orders set status='ready'; update orders set status='placed'; rollback;")
        self.assertIn("error", r)  # ready -> placed goes back
        r = sql(f"begin; {SEED} {ORDER}; update orders set status='accepted'; update orders set status='preparing'; "
                f"update orders set status='ready'; update orders set status='out_for_delivery'; update orders set status='delivered'; rollback;")
        self.assertNotIn("error", r)  # the legal path works

    def test_s3_retry_makes_one_order(self):
        r = sql(f"begin; {SEED} {ORDER}; {ORDER.replace('0000000000a1', '0000000000a2')} on conflict (session_id, client_order_key) do nothing; "
                f"select count(*) as n from orders; rollback;")
        self.assertEqual(r[-1]["n"], 1, r) if isinstance(r, list) else self.fail(r)


if __name__ == "__main__":
    unittest.main()
