# Story 1663 (epic 1652): two codes for each order, made by the server, each readable only by its holder.
# Every check ends in ROLLBACK (dev stays clean), with throwaway users. SKIP_MIG=1 runs against the database as it is (the red run).
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_order_codes.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

HERE = os.path.dirname(os.path.abspath(__file__))
MIG = "" if os.environ.get("SKIP_MIG") else open(os.path.join(HERE, "..", "supabase", "migrations", "20261124110000_order_codes.sql")).read()
CUS, CUS2, RID, RID2, KIT_U, ADM = ("00000000-0000-0000-0000-0000000000c%d" % i for i in range(1, 7))
KIT = "00000000-0000-0000-0000-0000000000f3"
O1, O2 = "00000000-0000-0000-0000-0000000000b1", "00000000-0000-0000-0000-0000000000b2"


def user(uid):
    return f"insert into auth.users (id, email, aud, role, instance_id) values ('{uid}', '{uid}@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')"


def order(oid, cus, key):
    return (f"insert into orders (id, kitchen_id, session_id, client_order_key, items, total_paise, address, customer_phone) "
            f"values ('{oid}', '{KIT}', '{cus}', '{key}', '[]', 100, 'x', '9000000000')")


def as_user(uid, body):
    return f"set local role authenticated; select set_config('request.jwt.claim.sub', '{uid}', true); {body}; reset role"


def read(oid):
    return f"select order_code_v1('{oid}') as r"


def reads(*pairs, after=()):
    """Each read runs as its user into a temp table; one final select returns every answer and the codes of O1 (the API shows only the last result)."""
    st = [as_user(u, f"create temp table t{i} as select order_code_v1('{o}') as r") for i, (u, o) in enumerate(pairs)]
    sel = ", ".join(f"(select r from t{i}) as r{i}" for i in range(len(pairs)))
    return run(*after, *st, f"select {sel}, (select pickup_code from order_codes where order_id = '{O1}') as p, (select drop_code from order_codes where order_id = '{O1}') as d")[-1]


def go(oid, *steps):
    return " ".join(f"update orders set status='{s}' where id='{oid}';" for s in steps)


SETUP = [user(u) for u in (CUS, CUS2, RID, RID2, KIT_U, ADM)] + [
    f"insert into admins (user_id) values ('{ADM}')",
    f"insert into kitchens (id, name, pin_codes) values ('{KIT}', 'Test kitchen', array['110016'])",
    f"insert into riders (user_id, name) values ('{RID}', 'Test rider'), ('{RID2}', 'Test rider two')",
    f"insert into kitchen_staff (kitchen_id, user_id, role) values ('{KIT}', '{KIT_U}', 'kitchen')",
    order(O1, CUS, "k1"), order(O2, CUS2, "k2"),
    f"update orders set rider_id = '{RID}' where id = '{O1}'"]


def run(*stmts, mig=True):
    return sql("begin; " + (MIG + "; " if MIG and mig else "") + "; ".join(SETUP + list(stmts)) + "; rollback;")


def codes(oid):
    return f"select pickup_code as p, drop_code as d from order_codes where order_id = '{oid}'"


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class OrderCodes(unittest.TestCase):
    def test_the_two_codes_are_four_digits_and_differ(self):
        r = run("select bool_and(pickup_code ~ '^[0-9]{4}$' and drop_code ~ '^[0-9]{4}$') as fmt, count(*) filter (where pickup_code = drop_code) as same, count(*) as n "
                "from order_codes where order_id in ('%s','%s')" % (O1, O2))[-1]
        self.assertEqual(r, {"fmt": True, "same": 0, "n": 2}, r)

    def test_two_orders_get_different_codes(self):
        # 20 orders: with 4 digits a chance clash of two pairs is 1 in 10^8 per pair, so a repeat across all would mean the codes are not random
        many = [order("00000000-0000-0000-0000-00000000e%03d" % i, CUS, "m%d" % i) for i in range(20)]
        r = run(*many, "select count(distinct pickup_code) as n, count(distinct drop_code) as m from order_codes")[-1]
        self.assertGreater(r["n"], 10, r)
        self.assertGreater(r["m"], 10, r)

    def test_the_assigned_rider_reads_only_the_pickup_code(self):
        r = reads((RID, O1))
        self.assertEqual(r["r0"], {"ok": True, "role": "rider", "pickup_code": r["p"]}, r)

    def test_the_customer_reads_only_the_drop_code(self):
        r = reads((CUS, O1))
        self.assertEqual(r["r0"], {"ok": True, "role": "customer", "drop_code": r["d"]}, r)

    def test_kitchen_admin_other_customer_other_rider_and_signed_out_read_nothing(self):
        r = reads((KIT_U, O1), (ADM, O1), (CUS2, O1), (RID2, O1), (CUS, "00000000-0000-0000-0000-0000000000ff"))
        for i in range(5):
            self.assertEqual(r[f"r{i}"], {"ok": False, "error": "no_code", "message": "No code for you on this order."}, (i, r))
        self.assertEqual(run(read(O1))[-1]["r"]["ok"], False)   # no uid set

    def test_nobody_can_select_the_table_directly(self):
        for who in (KIT_U, ADM, CUS, RID):
            self.assertIn("permission denied", str(run(as_user(who, "select * from order_codes"))), who)
        r = run("select has_table_privilege('anon', 'order_codes', 'select') as a, has_table_privilege('authenticated', 'order_codes', 'select') as b, "
                "has_function_privilege('anon', 'order_code_v1(uuid)', 'execute') as c, has_function_privilege('authenticated', 'order_code_try_v1(uuid,text,text)', 'execute') as d, "
                "has_function_privilege('anon', 'order_code_try_v1(uuid,text,text)', 'execute') as e")
        self.assertEqual(r[-1], {"a": False, "b": False, "c": False, "d": False, "e": False})

    def test_reassignment_moves_the_pickup_code_to_the_new_rider_only(self):
        r = reads((RID2, O1), (RID, O1), after=[f"update orders set rider_id = '{RID2}' where id = '{O1}'"])
        self.assertEqual(r["r0"], {"ok": True, "role": "rider", "pickup_code": r["p"]}, r)
        self.assertEqual(r["r1"]["ok"], False, r)

    def test_cancelled_and_delivered_orders_give_no_code(self):
        r = reads((RID, O1), (CUS, O1), after=[go(O1, "cancelled")])
        self.assertEqual((r["r0"]["ok"], r["r1"]["ok"]), (False, False), r)
        r = reads((RID, O1), (CUS, O1), after=[go(O1, "accepted", "preparing", "ready", "out_for_delivery", "delivered")])
        self.assertEqual((r["r0"]["ok"], r["r1"]["ok"]), (False, False), r)

    def test_codes_never_appear_in_orders_rows_or_order_events(self):
        r = run(go(O1, "accepted"),
                "select (select count(*) from orders where to_jsonb(orders)::text ~ 'pickup_code|drop_code') as a, "
                "(select count(*) from order_events where to_jsonb(order_events)::text ~ 'pickup_code|drop_code') as b, "
                "(select count(*) from orders o, order_codes c where o.id = c.order_id and (o.address like '%'||c.pickup_code||'%' and false)) as c")
        self.assertEqual((r[-1]["a"], r[-1]["b"]), (0, 0), r)

    def test_five_wrong_tries_lock_a_code_and_the_right_code_then_fails_too(self):
        right = f"(select pickup_code from order_codes where order_id = '{O1}')"
        wrong = f"select order_code_try_v1('{O1}', 'pickup', case when {right} = '0000' then '1111' else '0000' end)"
        state = (f"select order_code_try_v1('{O1}', 'pickup', {right}) as r, "
                 f"(select pickup_locked from order_codes where order_id = '{O1}') as p, (select drop_locked from order_codes where order_id = '{O1}') as d, "
                 f"(select pickup_tries from order_codes where order_id = '{O1}') as t")
        r = run(*[wrong] * 5, state)[-1]
        self.assertEqual(r, {"r": {"ok": False, "error": "locked"}, "p": True, "d": False, "t": 5}, r)
        r = run(*[wrong] * 4, state)[-1]   # the fifth try is the right one only if the lock has not fired: 4 wrong tries do not lock
        self.assertEqual((r["r"], r["p"], r["t"]), ({"ok": True}, False, 4), r)

    def test_the_migration_is_safe_to_run_twice(self):
        if not MIG:
            self.skipTest("SKIP_MIG")
        r = run(MIG, codes(O1), "select count(*) as n from order_codes where order_id in ('%s','%s')" % (O1, O2))
        self.assertNotIn("error", str(r))
        self.assertEqual(r[-1]["n"], 2, r)

    def test_orders_made_before_the_migration_get_codes(self):
        r = sql("begin; " + "; ".join(SETUP[:10]) + "; " + order(O1, CUS, "k1") + "; " + MIG + "; select count(*) as n from order_codes where order_id = '%s'; rollback;" % O1) if MIG else None
        if r is None:
            self.skipTest("SKIP_MIG")
        self.assertEqual(r[-1]["n"], 1, r)


if __name__ == "__main__":
    unittest.main()
