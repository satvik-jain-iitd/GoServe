# Story #880 (epic E32): the admin removes a rider who has old orders. The order history stays; the rider row goes.
# orders.rider_id points to riders(user_id); with no delete rule the delete was refused. Every check ends in ROLLBACK.
# SKIP_MIG=1 runs against the database as it is (the red run before the migration).
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_rider_remove.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

HERE = os.path.dirname(os.path.abspath(__file__))
MIG = "" if os.environ.get("SKIP_MIG") else open(os.path.join(HERE, "..", "supabase", "migrations", "20261105110000_rider_remove_keeps_orders.sql")).read()
BILL = '{"item_total_paise": 28000, "to_pay_paise": 30000}'
K1 = "00000000-0000-0000-0000-0000000000e1"
RIDER, ADMIN, STRANGER = ("00000000-0000-0000-0000-0000000000b%d" % i for i in (1, 2, 3))
DONE, OPEN = "00000000-0000-0000-0000-0000000000f1", "00000000-0000-0000-0000-0000000000f2"


def run(*stmts):
    return sql("begin; " + MIG + "; " + "; ".join(stmts) + "; rollback;")


def order(oid, key, status):
    return f"insert into orders (id, kitchen_id, session_id, client_order_key, items, total_paise, address, bill, status, rider_id) values ('{oid}', '{K1}', 's', '{key}', '[]'::jsonb, 30000, 'a', '{BILL}'::jsonb, '{status}', '{RIDER}')"


SETUP = [
    f"insert into kitchens (id, session_id, name, active, open, pin_codes) values ('{K1}', 's', 'Test One', true, true, array['110001'])",
    f"insert into riders (user_id, name) values ('{RIDER}', 'Amit')",
    f"insert into admins (user_id) values ('{ADMIN}')",
    order(DONE, "k1", "delivered"), order(OPEN, "k2", "preparing"),
]


def as_user(uid, body):
    return f"set local role authenticated; select set_config('request.jwt.claim.sub', '{uid}', true); {body}; reset role"


REMOVE = lambda uid: as_user(uid, f"select admin_remove_person('rider', '{RIDER}', null)")
AFTER = ("select (select count(*) from riders where user_id = '%s') riders, (select count(*) from orders) orders, "
         "(select rider_id from orders where id = '%s') done_rider, (select rider_id from orders where id = '%s') open_rider, (select status from orders where id = '%s') open_status")


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class RiderRemove(unittest.TestCase):
    def test_a_rider_with_a_delivered_order_can_be_removed_and_the_order_stays(self):
        r = run(*SETUP, REMOVE(ADMIN), AFTER % (RIDER, DONE, OPEN, OPEN))
        self.assertEqual((r[-1]["riders"], r[-1]["orders"], r[-1]["done_rider"]), (0, 2, None), r)

    def test_an_open_order_of_the_rider_goes_back_unassigned_with_its_status(self):
        r = run(*SETUP, REMOVE(ADMIN), AFTER % (RIDER, DONE, OPEN, OPEN))
        self.assertEqual((r[-1]["open_rider"], r[-1]["open_status"]), (None, "preparing"), r)

    def test_a_rider_with_no_orders_is_removed_as_before(self):
        r = run(*SETUP[:3], REMOVE(ADMIN), "select count(*) n from riders where user_id = '%s'" % RIDER)
        self.assertEqual(r[-1]["n"], 0, r)

    def test_the_rider_row_going_away_by_a_plain_delete_keeps_orders_too(self):
        r = run(*SETUP, f"delete from riders where user_id = '{RIDER}'", "select count(*) n, count(rider_id) r from orders")
        self.assertEqual((r[-1]["n"], r[-1]["r"]), (2, 0), r)

    def test_only_an_admin_can_remove_a_rider(self):
        r = run(*SETUP, REMOVE(STRANGER))
        self.assertIn("not_allowed", str(r))


if __name__ == "__main__":
    unittest.main()
