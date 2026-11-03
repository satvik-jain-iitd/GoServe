# Story #850 (epic E32), board K-Account: "Remove this kitchen". The data path only; the confirm sheet waits for its frame.
# Removing is soft: customers stop seeing the kitchen (active and open off) and its staff rows go, so those accounts can be added to another kitchen.
# Orders and every other row stay. It refuses while a kitchen still has orders to finish. Every check ends in ROLLBACK.
# SKIP_MIG=1 runs against the database as it is (the red run before the migration).
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_kitchen_remove.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

HERE = os.path.dirname(os.path.abspath(__file__))
MIG = "" if os.environ.get("SKIP_MIG") else open(os.path.join(HERE, "..", "supabase", "migrations", "20261104130000_kitchen_remove.sql")).read()
BILL = '{"item_total_paise": 28000, "to_pay_paise": 30000}'
K1, K2 = "00000000-0000-0000-0000-0000000000e1", "00000000-0000-0000-0000-0000000000e2"
COOK, OTHER, ADMIN, NOBODY = ("00000000-0000-0000-0000-0000000000c%d" % i for i in (1, 2, 3, 4))


def run(*stmts):
    return sql("begin; " + MIG + "; " + "; ".join(stmts) + "; rollback;")


SETUP = [
    f"insert into kitchens (id, session_id, name, active, open, pin_codes) values ('{K1}', 's', 'Test One', true, true, array['110001']), ('{K2}', 's', 'Test Two', true, true, array['110001'])",
    f"insert into kitchen_staff (kitchen_id, user_id, role) values ('{K1}', '{COOK}', 'kitchen'), ('{K1}', '{OTHER}', 'staff'), ('{K2}', '{OTHER}', 'staff')",
]


def as_user(uid, body):
    return f"set local role authenticated; select set_config('request.jwt.claim.sub', '{uid}', true); {body}; reset role"


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class KitchenRemove(unittest.TestCase):
    def remove(self, uid, *before):
        return run(*SETUP, f"insert into admins (user_id) values ('{ADMIN}')", *before, as_user(uid, f"create temp table r as select kitchen_remove_v2('{K1}') as v"),
                   "select v, (select active from kitchens where id = '%s') a1, (select open from kitchens where id = '%s') o1, (select active from kitchens where id = '%s') a2, "
                   "(select count(*) from kitchen_staff where kitchen_id = '%s') s1, (select count(*) from kitchen_staff where kitchen_id = '%s') s2 from r" % (K1, K1, K2, K1, K2))

    def test_a_cook_of_the_kitchen_switches_it_off_and_its_staff_rows_go(self):
        x = self.remove(COOK)[-1]
        self.assertTrue(x["v"]["ok"], x)
        self.assertEqual((x["a1"], x["o1"], x["s1"]), (False, False, 0), x)

    def test_another_kitchen_and_its_staff_are_untouched_so_the_account_can_be_added_there(self):
        x = self.remove(COOK)[-1]
        self.assertEqual((x["a2"], x["s2"]), (True, 1), x)

    def test_an_admin_can_remove_a_kitchen_too(self):
        x = self.remove(ADMIN)[-1]
        self.assertTrue(x["v"]["ok"], x)

    def test_it_refuses_while_the_kitchen_has_orders_to_finish_and_changes_nothing(self):
        busy = f"insert into orders (id, kitchen_id, session_id, client_order_key, items, total_paise, address, bill, status) values ('00000000-0000-0000-0000-0000000000f1', '{K1}', 's', 'k1', '[]'::jsonb, 30000, 'a', '{BILL}'::jsonb, 'preparing')"
        x = self.remove(COOK, busy)[-1]
        self.assertEqual(x["v"]["error"], "orders_open", x)
        self.assertEqual((x["a1"], x["s1"]), (True, 2), x)

    def test_a_finished_order_does_not_block_it_and_stays_afterwards(self):
        done = f"insert into orders (id, kitchen_id, session_id, client_order_key, items, total_paise, address, bill, status) values ('00000000-0000-0000-0000-0000000000f2', '{K1}', 's', 'k2', '[]'::jsonb, 30000, 'a', '{BILL}'::jsonb, 'delivered')"
        r = run(*SETUP, done, as_user(COOK, f"create temp table r as select kitchen_remove_v2('{K1}') as v"), "select v, (select count(*) from orders where kitchen_id = '%s') n from r" % K1)
        self.assertTrue(r[-1]["v"]["ok"], r)
        self.assertEqual(r[-1]["n"], 1, r)   # the order and its history stay

    def test_someone_who_does_not_work_there_cannot_remove_it(self):
        self.assertIn("not_allowed", str(run(*SETUP, as_user(NOBODY, f"select kitchen_remove_v2('{K1}')"))))

    def test_a_cook_of_another_kitchen_cannot_remove_this_one(self):
        r = run(*SETUP, f"delete from kitchen_staff where kitchen_id = '{K1}' and user_id = '{OTHER}'", as_user(OTHER, f"select kitchen_remove_v2('{K1}')"))
        self.assertIn("not_allowed", str(r))

    def test_the_signed_out_cannot_call_it(self):
        self.assertIn("permission denied", str(run("set local role anon", f"select kitchen_remove_v2('{K1}')")))


if __name__ == "__main__":
    unittest.main()
