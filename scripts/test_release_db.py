# Story #78, S1: release_db.py puts the migrations on the PROD database in order, after a dry run. No network is used here.
# Run: python3 -m unittest scripts/test_release_db.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import release_db

PROD = "prodprodprodprodprod"
URL = f"https://{PROD}.supabase.co"
TABLES = ["kitchens", "menu_items", "orders", "order_events", "decision_log", "run_log", "params"]


class Fake:
    """Stands in for the Management API: records every call, answers the checks."""
    def __init__(self, existing=()):
        self.calls, self.existing, self.auth = [], list(existing), {"external_anonymous_users_enabled": False}

    def sql(self, ref, query):
        self.calls.append(("sql", ref, query))
        if "count(*) from menu_items" in query:   # the check after the apply
            return [{"dishes": 10, "tables": 9, "policies": 6}]
        if "information_schema.tables" in query:   # the probe before
            return [{"table_name": t} for t in self.existing]
        return []

    name = "GoServe"

    def project_name(self, ref):
        self.calls.append(("project_name", ref))
        return self.name

    def get_auth(self, ref):
        self.calls.append(("get_auth", ref))
        return self.auth

    def set_auth(self, ref):
        self.calls.append(("set_auth", ref))
        self.auth = {"external_anonymous_users_enabled": True}


class ReleaseDb(unittest.TestCase):
    def setUp(self):
        self.api = Fake()
        release_db.sql, release_db.get_auth, release_db.set_auth, release_db.project_name = self.api.sql, self.api.get_auth, self.api.set_auth, self.api.project_name

    def test_ref_comes_from_the_prod_url_and_dev_is_refused(self):
        self.assertEqual(release_db.ref_from_url(URL), PROD)
        with self.assertRaises(SystemExit) as e:
            release_db.main([], {"SUPABASE_GOSERVE_PROD_URL": "https://tmxyizmkpwwfyazvrfhw.supabase.co"})
        self.assertIn("goserve-dev", str(e.exception))

    def test_the_project_name_is_read_and_must_say_goserve(self):
        release_db.main([], {"SUPABASE_GOSERVE_PROD_URL": URL})
        self.assertIn(("project_name", PROD), self.api.calls)
        self.api.name = "Some other project"
        for argv in ([], ["--apply"]):
            with self.assertRaises(SystemExit) as e:
                release_db.main(argv, {"SUPABASE_GOSERVE_PROD_URL": URL})
            self.assertIn("name", str(e.exception))
        self.assertFalse([c for c in self.api.calls if c[0] == "set_auth" or (c[0] == "sql" and "create table" in c[2].lower())])
        self.api.name = "goserve-dev"   # a dev-looking name is refused as well
        with self.assertRaises(SystemExit):
            release_db.main(["--apply"], {"SUPABASE_GOSERVE_PROD_URL": URL})

    def test_migrations_are_listed_in_order(self):
        names = [os.path.basename(p) for p in release_db.migration_files()]
        self.assertEqual(names, sorted(names))
        self.assertEqual(names[0], "0001_schema.sql")
        self.assertGreaterEqual(len(names), 7)

    def test_the_feedback_table_is_a_checked_app_table_with_its_migration(self):   # story S-B (#94)
        self.assertIn("feedback", release_db.APP_TABLES)
        self.assertIn("0008_feedback.sql", [os.path.basename(p) for p in release_db.migration_files()])

    def test_dry_run_only_reads(self):
        release_db.main([], {"SUPABASE_GOSERVE_PROD_URL": URL})
        for c in self.api.calls:
            self.assertIn(c[0], ("sql", "get_auth", "project_name"))
            if c[0] == "sql":
                self.assertTrue(c[2].strip().lower().startswith("select"), c[2])
        self.assertFalse([c for c in self.api.calls if c[0] == "set_auth"])

    def test_apply_refuses_a_database_that_already_has_tables(self):
        self.api.existing = ["orders"]
        with self.assertRaises(SystemExit) as e:
            release_db.main(["--apply"], {"SUPABASE_GOSERVE_PROD_URL": URL})
        self.assertIn("not empty", str(e.exception))
        self.assertFalse([c for c in self.api.calls if c[0] == "set_auth" or (c[0] == "sql" and "create table" in c[2].lower())])

    def test_apply_runs_every_file_in_order_then_turns_on_anonymous_sign_in_then_checks(self):
        release_db.main(["--apply"], {"SUPABASE_GOSERVE_PROD_URL": URL})
        writes = [c[2] for c in self.api.calls if c[0] == "sql" and not c[2].lower().startswith("select")]
        self.assertEqual(writes, [open(f).read() for f in release_db.migration_files()])   # every file, in order
        kinds = [c[0] for c in self.api.calls]
        self.assertLess(max(i for i, c in enumerate(self.api.calls) if c[0] == "sql" and not c[2].lower().startswith("select")), kinds.index("set_auth"))
        last_sql = [c for c in self.api.calls if c[0] == "sql"][-1]
        self.assertIn("count(*) from menu_items", last_sql[2])   # the checks come last
        self.assertLess(kinds.index("set_auth"), len(kinds) - 1)
        self.assertTrue(all(c[1] == PROD for c in self.api.calls))
        self.assertTrue(self.api.auth["external_anonymous_users_enabled"])

    def test_a_failed_check_stops_with_a_message(self):
        orig = self.api.sql
        def bad(ref, q):
            return [{"dishes": 3, "tables": 9, "policies": 6}] if "count(*) from menu_items" in q else orig(ref, q)
        release_db.sql = bad
        with self.assertRaises(SystemExit) as e:
            release_db.main(["--apply"], {"SUPABASE_GOSERVE_PROD_URL": URL})
        self.assertIn("Check failed", str(e.exception))


if __name__ == "__main__":
    unittest.main()
