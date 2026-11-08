# Story #677: prod_backend_v2.py plans the missing v2 migrations in order and refuses dev. No network is used here.
# Run: python3 -m unittest scripts/test_prod_backend_v2.py
import contextlib, io, os, stat, sys, tempfile, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import prod_backend_v2 as p
import release_db

PROD = "prodprodprodprodprod"
V1, V2 = p.load("app/supabase/migrations"), p.load("supabase/migrations")
ALL = {m for _, m in V1 + V2 if m}


class Fake:
    """Stands in for the Management API and the prod functions: records every write."""
    def __init__(self, present, name="GoServe"):
        self.present, self.name, self.writes = set(present), name, []

    def sql(self, ref, query):
        if query == p.PRESENT_SQL:
            return [{"m": m} for m in self.present]
        self.writes.append(("sql", query[:40]))
        return []

    def project_name(self, ref):
        return self.name

    def call(self, method, ref, path, body=None):
        if method == "GET":
            return {"/functions": [], "/secrets": []}[path]
        self.writes.append((method, path))

    def get_auth(self, ref):
        return {"external_anonymous_users_enabled": True}


def run(fake, argv, vault=None):
    saved = (release_db.sql, release_db.project_name, release_db._call, release_db.get_auth, p.deploy, p.checks, p.VAULT)
    release_db.sql, release_db.project_name, release_db._call, release_db.get_auth = fake.sql, fake.project_name, fake.call, fake.get_auth
    p.deploy = lambda ref, n: fake.writes.append(("deploy", n))
    p.checks = lambda url, anon: True
    p.VAULT = vault or os.path.join(tempfile.mkdtemp(), "v.env")
    out = io.StringIO()
    try:
        with contextlib.redirect_stdout(out):
            p.main(argv, {"SUPABASE_GOSERVE_PROD_URL": f"https://{PROD}.supabase.co", "SUPABASE_GOSERVE_PROD_ANON_KEY": "anon"})
    finally:
        release_db.sql, release_db.project_name, release_db._call, release_db.get_auth, p.deploy, p.checks, p.VAULT = saved
    return out.getvalue()


class Plan(unittest.TestCase):
    def test_S1_the_plan_lists_exactly_the_missing_v2_files_in_order(self):
        have = {m for _, m in V1 if m} | {m for _, m in V2[:10]}
        plan = p.build_plan(PROD, "GoServe", V1, V2, have)
        self.assertEqual(plan["v2_missing"], [f for f, _ in V2[10:]])
        self.assertEqual(plan["v1_gaps"], [])

    def test_S2_nothing_missing_when_all_markers_are_there(self):
        self.assertEqual(p.build_plan(PROD, "GoServe", V1, V2, ALL), {"v1_gaps": [], "v2_missing": []})

    def test_S3_a_v1_gap_is_named(self):
        have = ALL - {m for f, m in V1 if f.startswith("0044")}
        self.assertEqual(p.build_plan(PROD, "GoServe", V1, V2, have)["v1_gaps"], ["0044_order_trace.sql"])

    def test_S4_refuses_dev_and_other_names(self):
        for ref, name in ((release_db.DEV_REF, "GoServe"), (PROD, "goserve-dev"), (PROD, "Something else")):
            with self.assertRaises(p.Refused):
                p.build_plan(ref, name, V1, V2, ALL)

    def test_S5_every_v2_file_names_one_object(self):
        self.assertEqual([f for f, m in V2 if m is None], [])
        self.assertEqual(len(V2), 57)   # story 1068: decide_rules is the 57th; story 1067: web_push_now is the 56th; story 1031: place_aliases is the 55th; story 1029: search_places and the names seed in two files are the 52nd to 54th; story 1027: place_search is the 51st; story 942: purge_pii replaces the purge function, the 50th; story 987: nearest_pin and the pincodes seed in two files are the 47th to 49th; story 1015: live_eta is the 46th; story 1017: cancelled_by is the 45th; story 976: addresses is the 44th; story 985: owner_admin is the 43th; story 935: order_instructions is the 42nd; story 968: admin_invite is the 41st; story 941: sim_dev_only is the 40th; story 922: push_arriving is the 39th; story 920: push_outbox_stale, push_latest_order_id and health_push_wait are the 36th to 38th; story 905: kitchen_location_drop_point is the 35th; story 904: cancel_customer_first is the 34th; story 779: dish_description is the 33rd; story 880: rider_remove_keeps_orders is the 32nd; story 875: staff_invites is the 31st; story 873: sim_clear_all in slices is the 30th; story 850: kitchen_remove is the 29th; story 848: sim_groups is the 28th; story 619: the settings migration is the 24th, its admin functions the 25th; story #802a: otp_repair_phone_form is the 26th; story 829: the phone code switch is the 27th

    def test_S6_markers(self):
        self.assertEqual(p.marker("-- c\ncreate table if not exists public.t (a int);"), "table:t")
        self.assertEqual(p.marker("create or replace function f(a text, b numeric(10,2) default 1) returns int as $$ x $$"), "function:f/2")
        self.assertEqual(p.marker("create function g() returns int as $$ x $$"), "function:g/0")
        self.assertEqual(p.marker("alter table orders add column if not exists bill jsonb;"), "column:orders.bill")
        self.assertEqual(p.marker("alter table orders drop constraint a_fkey;\nalter table orders add constraint a_new foreign key (x) references y (z);"), "constraint:a_new")   # story 880
        self.assertIsNone(p.marker("update t set a = 1;"))


class Functions(unittest.TestCase):
    def test_S7_all_14_functions_with_shared_files_and_no_tests(self):
        self.assertEqual(len(p.function_names()), 15)
        files = p.function_files("otp")
        self.assertIn("otp/index.ts", files)
        self.assertIn("_shared/runlog.ts", files)
        self.assertFalse([f for f in files if f.endswith(".test.ts")])

    def test_S7b_orders_and_coupons_get_the_quote_files_they_import(self):   # prod run, 29 Oct: orders stopped, "could not find quote/index.ts"
        for n in ("orders", "coupons"):
            files = p.function_files(n)
            self.assertIn("quote/index.ts", files)
            self.assertIn("quote/quote.ts", files)

    def test_S8_verify_jwt_follows_config(self):
        self.assertEqual([n for n in p.function_names() if not p.verify_jwt(n)], ["health", "payments", "push"])


class Main(unittest.TestCase):
    def test_S9_dry_run_writes_nothing_and_prints_no_value(self):
        fake = Fake({m for _, m in V1 if m})
        vault = os.path.join(tempfile.mkdtemp(), "v.env")
        out = run(fake, [], vault)
        self.assertEqual(fake.writes, [])
        self.assertFalse(os.path.exists(vault))
        self.assertIn("will deploy all 15", out)
        self.assertIn("20261028070000_coupon_by_code_session.sql", out)
        self.assertNotIn("123456", out)

    def test_S10_apply_runs_in_order_and_stops_on_a_v1_gap(self):
        fake = Fake(ALL - {m for f, m in V1 if f.startswith("0044")})
        with self.assertRaises(SystemExit):
            run(fake, ["--apply"])
        self.assertEqual(fake.writes, [])

    def test_S11_apply_order_and_fresh_secrets_in_the_vault_first(self):
        fake = Fake({m for _, m in V1 if m} | {m for _, m in V2[:-1]})
        vault = os.path.join(tempfile.mkdtemp(), "v.env")
        out = run(fake, ["--apply"], vault)
        kinds = [w[0] for w in fake.writes]
        self.assertEqual(kinds[0], "sql")                      # the one missing migration first
        self.assertEqual(kinds[1:16], ["deploy"] * 15)         # then all functions
        self.assertEqual(kinds[16], "POST")                    # then the secrets
        self.assertEqual(os.stat(vault).st_mode & 0o777, 0o600)
        keys = [l.split("=")[0] for l in open(vault) if "=" in l]
        self.assertEqual(keys, ["PAYMENTS_WEBHOOK_SECRET", "PUSH_NOTIFY_SECRET"])
        for l in open(vault):
            if "=" in l:
                self.assertNotIn(l.strip().split("=")[1], out)  # no value is printed


if __name__ == "__main__":
    unittest.main()
