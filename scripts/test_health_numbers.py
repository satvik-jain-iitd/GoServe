# Story #488 (E25): health_numbers() also answers the Supabase free limits that SQL can give: storage size, auth users, users active in 30 days.
# Every check ends in ROLLBACK. Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_health_numbers.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql


def run(*stmts):
    return sql("begin; " + "; ".join(stmts) + "; rollback;")


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class HealthNumbers(unittest.TestCase):
    def test_storage_and_user_numbers_are_there_and_sane(self):
        r = run("select (health_numbers()->>'storage_mb')::numeric as storage, (health_numbers()->>'users')::int as users, (health_numbers()->>'users_active_30d')::int as active")
        self.assertIsInstance(r, list, r)
        row = r[-1]
        self.assertGreaterEqual(float(row["storage"]), 0, r)
        self.assertGreaterEqual(row["users"], row["active"], r)

    def test_the_old_numbers_are_still_there(self):
        r = run("select health_numbers() ?& array['db_mb', 'connections', 'rows', 'oldest', 'caps', 'ai'] as keys")
        self.assertEqual(r[-1], {"keys": True}, r)

    def test_a_customer_still_cannot_call_it(self):
        self.assertIn("permission denied", str(run("set local role authenticated", "select health_numbers()")))


if __name__ == "__main__":
    unittest.main()
