# Story #341 (E27, plan v2 B.5): saved addresses. Scenario: Given a signed-in customer, when they save an address, then it is stored with
# lat, lng, house, building and label and only they can read it.
# "Signed in" is auth.uid() from the JWT, so the tests set the JWT claims by hand; the login itself is #339.
# Every check ends in ROLLBACK (dev stays clean). Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_addresses.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

A = "00000000-0000-0000-0000-0000000000a1"
B = "00000000-0000-0000-0000-0000000000a2"
SETUP = [
    f"insert into auth.users (id) values ('{A}'), ('{B}')",
    f"insert into addresses (user_id, label, house, building, pin_code, lat, lng) values ('{B}', 'Home', '12', 'Sunrise Apts', '110016', 28.55, 77.2)",
]
NEW = "insert into addresses (label, house, building, pin_code, lat, lng) values ('Home', '4B', 'Green Court', '110016', 28.5494, 77.2001)"


def as_user(uid):
    return ["set local role authenticated", f"select set_config('request.jwt.claims', '{{\"sub\":\"{uid}\",\"role\":\"authenticated\"}}', true)"]


def run(*stmts):
    return sql("begin; " + "; ".join(SETUP + list(stmts)) + "; rollback;")


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class Addresses(unittest.TestCase):
    def test_a_customer_saves_an_address_and_reads_it_back_with_every_field(self):
        r = run(*as_user(A), NEW, "select label, house, building, pin_code, lat, lng, user_id from addresses")
        self.assertEqual(r[-1], {"label": "Home", "house": "4B", "building": "Green Court", "pin_code": "110016", "lat": 28.5494, "lng": 77.2001, "user_id": A}, r)

    def test_a_customer_sees_only_their_own_addresses(self):
        r = run(*as_user(A), NEW, "select count(*) as n from addresses")
        self.assertEqual(r[-1], {"n": 1}, r)   # B's row is hidden

    def test_a_customer_cannot_change_delete_or_save_for_someone_else(self):
        r = run(*as_user(A), f"update addresses set house = 'x' where user_id = '{B}'", f"delete from addresses where user_id = '{B}'",
                "reset role", f"select house from addresses where user_id = '{B}'")
        self.assertEqual(r[-1], {"house": "12"}, r)
        self.assertIn("row-level security", str(run(*as_user(A), f"insert into addresses (user_id, label, house, building, pin_code, lat, lng) values ('{B}', 'Home', '1', 'x', '110016', 28.5, 77.2)")))

    def test_a_customer_can_update_and_delete_their_own(self):
        r = run(*as_user(A), NEW, "update addresses set house = '5C' where user_id = auth.uid()", "select house from addresses")
        self.assertEqual(r[-1], {"house": "5C"}, r)
        r = run(*as_user(A), NEW, "delete from addresses where user_id = auth.uid()", "select count(*) as n from addresses")
        self.assertEqual(r[-1], {"n": 0}, r)

    def test_no_login_cannot_even_touch_the_table(self):
        self.assertIn("permission denied", str(run("set local role anon", "select count(*) as n from addresses")))
        self.assertIn("permission denied", str(run("set local role anon", NEW)))

    def test_the_database_refuses_a_bad_pin_a_bad_place_and_an_empty_label(self):
        for bad in ("'11001'", "'abcdef'"):
            self.assertIn("error", str(run(*as_user(A), NEW.replace("'110016'", bad))), bad)
        self.assertIn("error", str(run(*as_user(A), NEW.replace("28.5494", "91"))))
        self.assertIn("error", str(run(*as_user(A), NEW.replace("77.2001", "181"))))
        self.assertIn("error", str(run(*as_user(A), NEW.replace("'Home'", "' '"))))

    def test_only_one_address_is_the_default_per_customer(self):
        two = NEW.replace("pin_code, lat", "pin_code, is_default, lat").replace("'110016', 28", "'110016', true, 28")
        self.assertIn("error", str(run(*as_user(A), two, two)))
        r = run(*as_user(A), two, f"insert into addresses (label, house, building, pin_code, lat, lng) values ('Work', '9', 'Tower', '110016', 28.5, 77.2)", "select count(*) as n from addresses")
        self.assertEqual(r[-1], {"n": 2}, r)


if __name__ == "__main__":
    unittest.main()
