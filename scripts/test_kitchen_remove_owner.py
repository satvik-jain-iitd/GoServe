# Story 944 (hardening): kitchen_remove_v2 is for the kitchen's owner or an admin; other staff are refused.
# Every check ends in ROLLBACK. SKIP_MIG=1 runs against the database as it is (the red run).
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_kitchen_remove_owner.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

HERE = os.path.dirname(os.path.abspath(__file__))
MIG = "" if os.environ.get("SKIP_MIG") else open(os.path.join(HERE, "..", "supabase", "migrations", "20261124150000_kitchen_remove_owner_only.sql")).read()
K1 = "00000000-0000-0000-0000-0000000000e1"
OWNER, STAFF, ADMIN = ("00000000-0000-0000-0000-0000000000c%d" % i for i in (1, 2, 3))
SETUP = [
    f"insert into kitchens (id, session_id, name, active, open, pin_codes) values ('{K1}', 's', 'Test One', true, true, array['110001'])",
    f"insert into kitchen_staff (kitchen_id, user_id, role) values ('{K1}', '{OWNER}', 'owner'), ('{K1}', '{STAFF}', 'staff')",
    f"insert into admins (user_id) values ('{ADMIN}')",
]


def remove(uid):
    body = f"set local role authenticated; select set_config('request.jwt.claim.sub', '{uid}', true); create temp table r as select kitchen_remove_v2('{K1}') as v; reset role"
    return sql("begin; " + MIG + "; " + "; ".join(SETUP) + "; " + body + f"; select v, (select active from kitchens where id = '{K1}') a from r; rollback;")


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class KitchenRemoveOwner(unittest.TestCase):
    def test_a_staff_member_who_is_not_the_owner_is_refused_by_name(self):
        try:
            r = remove(STAFF)
        except Exception as e:
            r = str(e)
        self.assertIn("owner_only", str(r))

    def test_the_owner_can_remove_it(self):
        x = remove(OWNER)[-1]
        self.assertEqual((x["v"]["ok"], x["a"]), (True, False), x)

    def test_an_admin_can_remove_it(self):
        x = remove(ADMIN)[-1]
        self.assertEqual((x["v"]["ok"], x["a"]), (True, False), x)


if __name__ == "__main__":
    unittest.main()
