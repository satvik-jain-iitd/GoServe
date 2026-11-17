# Story #1608: the near distance of a saved address is 100 m (owner, 17 Nov 2026; it was 200). The migration moves the setting only when it is still 200,
# so an admin's own value is kept; with no row address_near_m() answers 100; the text can run twice.
# Every check ends in ROLLBACK (dev stays clean). The migration runs inside each transaction; SKIP_MIG=1 runs against the database as it is (the red run before the migration).
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_address_near_100.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql
from test_addresses import A, as_user, user

HERE = os.path.dirname(os.path.abspath(__file__))
MIG = "" if os.environ.get("SKIP_MIG") else open(os.path.join(HERE, "..", "supabase", "migrations", "20261117100000_address_near_100.sql")).read()
ROW = "insert into settings (name, value) values ('address_near_m', '%s'::jsonb) on conflict (name) do update set value = excluded.value"
READ = [user(A), as_user(A, "select address_near_m() as m")]


def run(before, times=1):
    return str(sql("begin; " + before + "; " + MIG * times + "; " + "; ".join(READ) + "; rollback;"))


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class AddressNear100(unittest.TestCase):
    def test_d1_a_setting_still_at_200_becomes_100(self):
        self.assertIn("'m': 100", run(ROW % 200))

    def test_d2_a_value_the_admin_set_is_kept(self):
        self.assertIn("'m': 350", run(ROW % 350))

    def test_d3_with_no_row_the_answer_is_100(self):
        self.assertIn("'m': 100", run("delete from settings where name = 'address_near_m'"))

    def test_d4_the_text_runs_twice(self):
        self.assertIn("'m': 100", run(ROW % 200, times=2))


if __name__ == "__main__":
    unittest.main()
