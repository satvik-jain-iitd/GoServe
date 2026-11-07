# Story #941 (epic #939): every simulator write refuses unless the dev-only settings row clear_allowed is true, so on prod (no row) the simulator moves, cancels and deletes nothing.
# Every check ends in ROLLBACK (dev stays clean). The migration runs inside each transaction first; SKIP_MIG=1 runs against the database as it is (the red run).
# Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_sim_dev_only.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

_MIGS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "supabase", "migrations")
MIG = "" if os.environ.get("SKIP_MIG") else open(os.path.join(_MIGS, "20261107120000_sim_dev_only.sql")).read()
PROD = "delete from settings where name = 'clear_allowed'"   # a database with no row, like prod
DEV = "insert into settings (name, value) values ('clear_allowed', 'true') on conflict (name) do update set value = 'true'"


def run(*stmts):
    return sql("begin; " + MIG + "; " + "; ".join(stmts) + "; rollback;")


def refused(r):
    return isinstance(r, dict) and "sim_not_allowed" in str(r.get("error", ""))


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class SimDevOnly(unittest.TestCase):
    def test_s1_a_write_is_refused_where_the_row_is_absent(self):
        for call in ("sim_reset()", "sim_set_knobs('{}'::jsonb)", "sim_enable('{\"enabled\": true}'::jsonb)", "set_sim_riders_serve_all(true)"):
            with self.subTest(call=call):
                self.assertTrue(refused(run(PROD, f"select {call}")), call)

    def test_s2_the_two_ticks_skip_quietly_where_the_row_is_absent(self):
        r = run(PROD, "select sim_tick('{}'::jsonb) t, sim_orders_tick() o")
        self.assertIsInstance(r, list, r)
        self.assertEqual(r[0]["t"]["skipped"], "sim_not_allowed")
        self.assertEqual(r[0]["o"]["skipped"], "sim_not_allowed")

    def test_s3_a_refused_reset_leaves_every_synthetic_row_and_order_alone(self):
        before = "(select count(*) from kitchens where synthetic) k, (select count(*) from riders where synthetic) r, (select count(*) from menu_items where synthetic) d, (select count(*) from orders) o"
        r = run(PROD, "create temp table b as select " + before, "do $$ begin perform sim_reset(); exception when others then null; end $$",
                "select (select count(*) from b where k = x.k and r = x.r and d = x.d and o = x.o) same from (select " + before + ") x")
        self.assertIsInstance(r, list, r)
        self.assertEqual(r[0]["same"], 1)

    def test_s4_turning_serve_all_off_is_allowed_anywhere_and_it_starts_off(self):
        r = run(PROD, "select sim_riders_serve_all() d")
        self.assertIsInstance(r, list, r)
        self.assertIs(r[0]["d"], False)
        # is_admin() is false in this connection, so the setter refuses with not_admin (the guard let the call through), never with sim_not_allowed
        self.assertFalse(refused(run(PROD, "select set_sim_riders_serve_all(false)")))

    def test_s5_where_the_row_is_true_the_writes_work(self):
        r = run(DEV, "select sim_enable('{\"enabled\": false}'::jsonb) e, sim_set_knobs('{}'::jsonb) k, sim_reset() r")
        self.assertIsInstance(r, list, r)
        self.assertIs(r[0]["e"]["ok"], True)
        self.assertIs(r[0]["r"]["ok"], True)

    def test_s6_the_unguarded_bodies_are_not_callable_by_an_api_role(self):
        fns = ["sim_reset_unguarded()", "sim_set_knobs_unguarded(jsonb)", "sim_enable_unguarded(jsonb)", "sim_tick_unguarded(jsonb)", "sim_orders_tick_unguarded()", "set_sim_riders_serve_all_unguarded(boolean)"]
        q = ", ".join(f"has_function_privilege('{role}', '{f}', 'execute') as \"{role}_{i}\"" for i, f in enumerate(fns) for role in ("anon", "authenticated", "service_role"))
        r = run("select " + q)
        self.assertIsInstance(r, list, r)
        self.assertEqual([k for k, v in r[0].items() if v], [], r)
        self.assertTrue(run("select has_function_privilege('service_role', 'sim_reset()', 'execute') ok")[0]["ok"])
        self.assertFalse(run("select has_function_privilege('anon', 'sim_reset()', 'execute') ok")[0]["ok"])

    def test_s7_clear_allowed_for_the_app_is_false_for_the_anon_role_and_needs_an_admin(self):
        self.assertFalse(run("select has_function_privilege('anon', 'sim_clear_allowed()', 'execute') ok")[0]["ok"])
        self.assertTrue(run("select has_function_privilege('authenticated', 'sim_clear_allowed()', 'execute') ok")[0]["ok"])
        self.assertIs(run(DEV, "select sim_clear_allowed() a")[0]["a"], False)   # this connection is no admin


if __name__ == "__main__":
    unittest.main()
