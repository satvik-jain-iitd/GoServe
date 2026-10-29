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
        self.assertEqual(len(V2), 23)

    def test_S6_markers(self):
        self.assertEqual(p.marker("-- c\ncreate table if not exists public.t (a int);"), "table:t")
        self.assertEqual(p.marker("create or replace function f(a text, b numeric(10,2) default 1) returns int as $$ x $$"), "function:f/2")
        self.assertEqual(p.marker("create function g() returns int as $$ x $$"), "function:g/0")
        self.assertEqual(p.marker("alter table orders add column if not exists bill jsonb;"), "column:orders.bill")
        self.assertIsNone(p.marker("update t set a = 1;"))


class Functions(unittest.TestCase):
    def test_S7_all_13_functions_with_shared_files_and_no_tests(self):
        self.assertEqual(len(p.function_names()), 13)
        files = p.function_files("otp")
        self.assertIn("otp/index.ts", files)
        self.assertIn("_shared/runlog.ts", files)
        self.assertFalse([f for f in files if f.endswith(".test.ts")])

    def test_S8_verify_jwt_follows_config(self):
        self.assertEqual([n for n in p.function_names() if not p.verify_jwt(n)], ["health", "payments", "push"])


class Main(unittest.TestCase):
    def test_S9_dry_run_writes_nothing_and_prints_no_value(self):
        fake = Fake({m for _, m in V1 if m})
        vault = os.path.join(tempfile.mkdtemp(), "v.env")
        out = run(fake, [], vault)
        self.assertEqual(fake.writes, [])
        self.assertFalse(os.path.exists(vault))
        self.assertIn("will deploy all 13", out)
        self.assertIn("20261028070000_coupon_by_code_session.sql", out)
        self.assertNotIn("123456", out)

    def test_S10_apply_runs_in_order_and_stops_on_a_v1_gap(self):
        fake = Fake(ALL - {m for f, m in V1 if f.startswith("0044")})
        with self.assertRaises(SystemExit):
            run(fake, ["--apply"])
        self.assertEqual(fake.writes, [])

    def test_S11_apply_order_and_fresh_secrets_in_the_vault_first(self):
        fake = Fake({m for _, m in V1 if m} | {m for _, m in V2[:22]})
        vault = os.path.join(tempfile.mkdtemp(), "v.env")
        out = run(fake, ["--apply"], vault)
        kinds = [w[0] for w in fake.writes]
        self.assertEqual(kinds[0], "sql")                      # the one missing migration first
        self.assertEqual(kinds[1:14], ["deploy"] * 13)         # then all functions
        self.assertEqual(kinds[14], "POST")                    # then the secrets
        self.assertEqual(os.stat(vault).st_mode & 0o777, 0o600)
        keys = [l.split("=")[0] for l in open(vault) if "=" in l]
        self.assertEqual(keys, ["PAYMENTS_WEBHOOK_SECRET", "PUSH_NOTIFY_SECRET"])
        for l in open(vault):
            if "=" in l:
                self.assertNotIn(l.strip().split("=")[1], out)  # no value is printed


if __name__ == "__main__":
    unittest.main()
