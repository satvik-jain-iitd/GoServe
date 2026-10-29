# Story #619 layer b: the admin's settings table. One row now: swap_discount_pct (0 to 50, default 10). Service role writes; nobody else reads or writes.
# Every check ends in ROLLBACK (dev stays clean). Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_settings.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql


def run(*stmts):
    return sql("begin; " + "; ".join(stmts) + "; rollback;")


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class Settings(unittest.TestCase):
    def test_the_swap_discount_starts_at_10(self):
        r = run("select value from settings where name = 'swap_discount_pct'")
        self.assertEqual(r[-1]["value"], 10, r)

    def test_a_value_from_0_to_50_is_kept(self):
        for v in (0, 25, 50):
            r = run(f"update settings set value = '{v}'::jsonb, updated_at = now() where name = 'swap_discount_pct'", "select value from settings where name = 'swap_discount_pct'")
            self.assertEqual(r[-1]["value"], v, r)

    def test_a_value_outside_0_to_50_or_not_a_whole_number_is_refused(self):
        for v in ("51", "-1", "10.5", '"ten"', "null"):
            r = run(f"update settings set value = '{v}'::jsonb where name = 'swap_discount_pct'")
            self.assertIn("violates", str(r), v)

    def test_nobody_but_the_service_role_can_read_or_write(self):
        for who in ("set local role anon", "set local role authenticated"):
            self.assertIn("permission denied", str(run(who, "select * from settings")), who)
            self.assertIn("permission denied", str(run(who, "update settings set value = '50'::jsonb")), who)

    def test_a_name_is_one_row(self):
        self.assertIn("duplicate key", str(run("insert into settings (name, value) values ('swap_discount_pct', '5'::jsonb)")))


if __name__ == "__main__":
    unittest.main()
