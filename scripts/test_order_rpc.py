# Story #45: the database does the order work. place_order and change_status run in one transaction,
# so an order and its event are written together or not at all. Every check ends in ROLLBACK (dev stays clean).
# Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_order_rpc.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

DISH = "(select id from menu_items order by price_paise limit 1)"
PRICE = "(select price_paise from menu_items order by price_paise limit 1)"
PLACE = "select place_order('s1', 'key1', jsonb_build_array(jsonb_build_object('menu_item_id', {d}, 'qty', 3)), 'Flat 4, Delhi')".format(d=DISH)
ID = "(select id from orders where session_id='s1')"


def run(*stmts):
    return sql("begin; " + "; ".join(stmts) + "; rollback;")


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class OrderRpc(unittest.TestCase):
    def test_place_order_result_and_retry(self):
        r = run(f"select (place_order('s1','key1', jsonb_build_array(jsonb_build_object('menu_item_id', {DISH}, 'qty', 3)), 'Flat 4')->>'created')::boolean as first",
                f"select (place_order('s1','key1', jsonb_build_array(jsonb_build_object('menu_item_id', {DISH}, 'qty', 3)), 'Flat 4')->>'created')::boolean as retry",
                "select (select count(*) from orders where session_id='s1') as orders, (select count(*) from order_events where session_id='s1') as events, "
                f"(select total_paise from orders where session_id='s1') = 3 * {PRICE} as price_ok")
        self.assertIsInstance(r, list, r)
        self.assertEqual(r[-1], {"orders": 1, "events": 1, "price_ok": True}, r)

    def test_bad_items_are_refused(self):
        for items in ["'[]'", "'[{\"menu_item_id\": \"00000000-0000-0000-0000-000000000000\", \"qty\": 1}]'",
                      f"jsonb_build_array(jsonb_build_object('menu_item_id', {DISH}, 'qty', 0))"]:
            self.assertIn("invalid_item", str(run(f"select place_order('s1','k', {items}, 'x')")), items)
        r = run(f"select place_order('s1','k', jsonb_build_array(jsonb_build_object('menu_item_id', {DISH}, 'qty', 1)), '  ')")
        self.assertIn("invalid_address", str(r))

    def test_change_status_writes_one_event_per_step(self):
        r = run(PLACE,
                f"select change_status({ID}, 's1', 'accepted', 'kitchen')",
                f"select change_status({ID}, 's1', 'preparing', 'kitchen')",
                f"select change_status({ID}, 's1', 'ready', 'kitchen')",
                "select array_agg(event order by id) as events from order_events where session_id='s1'")
        self.assertIsInstance(r, list, r)
        self.assertEqual(r[-1]["events"], ["order.placed", "order.accepted", "order.preparing", "order.ready"], r)

    def test_illegal_step_errors_and_writes_nothing(self):
        r = run(PLACE, f"select change_status({ID}, 's1', 'ready', 'kitchen')")
        self.assertIn("illegal status step", str(r))
        r = run(PLACE, f"select change_status({ID}, 's1', 'flying', 'kitchen')")
        self.assertIn("invalid_status", str(r))
        # Nothing written: catch the error inside the transaction, then count what is left.
        r = run(PLACE,
                f"do $$ begin perform change_status({ID}, 's1', 'ready', 'kitchen'); exception when others then null; end $$",
                "select (select count(*) from order_events where session_id='s1') as events, (select status from orders where session_id='s1') as status")
        self.assertEqual(r[-1], {"events": 1, "status": "placed"}, r)

    def test_other_session_cannot_change_the_order(self):
        r = run(PLACE, f"select change_status({ID}, 's2', 'accepted', 'kitchen')")
        self.assertIn("order_not_found", str(r))

    def test_even_if_granted_by_mistake_row_level_security_still_blocks_the_write(self):
        r = run("grant execute on function place_order(text,text,jsonb,text) to authenticated", "set local role authenticated",
                "select set_config('request.jwt.claims', '{\"sub\":\"00000000-0000-0000-0000-0000000000e1\",\"role\":\"authenticated\"}', true)", PLACE)
        self.assertIn("row-level security", str(r))

    def test_a_session_can_place_at_most_20_orders_but_a_retry_still_works(self):
        fill = ("do $$ begin for i in 1..20 loop perform place_order('s1', 'k' || i, jsonb_build_array(jsonb_build_object("
                f"'menu_item_id', {DISH}, 'qty', 1)), 'x'); end loop; end $$")
        again = f"select place_order('s1', 'k20', jsonb_build_array(jsonb_build_object('menu_item_id', {DISH}, 'qty', 1)), 'x')"
        over = f"select place_order('s1', 'k21', jsonb_build_array(jsonb_build_object('menu_item_id', {DISH}, 'qty', 1)), 'x')"
        r = run(fill, again, "select (select count(*) from orders where session_id='s1') as n")
        self.assertEqual(r[-1], {"n": 20}, r)   # the retry of k20 is not a 21st order
        self.assertIn("session_order_cap", str(run(fill, over)))
        r = run(fill, "select place_order('s2', 'k1', jsonb_build_array(jsonb_build_object('menu_item_id', "
                      f"{DISH}, 'qty', 1)), 'x')")
        self.assertTrue(r[-1]["place_order"]["created"], r)   # another session is not affected

    def test_decision_and_run_rows_in_the_shape_the_workflows_write_are_accepted(self):
        k = "(select id from kitchens limit 1)"
        r = run(PLACE,
                f"insert into decision_log (kitchen_id, session_id, order_id, decision) select {k}, 's1', {ID}, "
                "'{\"use_case\":\"D1\",\"rule_pick\":\"r2\",\"jev\":null}'::jsonb",
                f"insert into run_log (kitchen_id, session_id, workflow, params_version, duration_ms, cost, error) values ({k}, 's1', 'GS MAIN 01 Order API: place', 1, 120, 0.00002, null)",
                "select (select count(*) from decision_log where session_id='s1') as d, (select count(*) from run_log where session_id='s1') as r")
        self.assertEqual(r[-1], {"d": 1, "r": 1}, r)

    def test_the_phone_keys_cannot_call_them(self):
        r = sql("select has_function_privilege('anon', 'place_order(text,text,jsonb,text)', 'execute') a, "
                "has_function_privilege('authenticated', 'change_status(uuid,text,text,text)', 'execute') b, "
                "has_function_privilege('service_role', 'place_order(text,text,jsonb,text)', 'execute') c")
        self.assertIsInstance(r, list, r)
        self.assertEqual(r[0], {"a": False, "b": False, "c": True}, r)


if __name__ == "__main__":
    unittest.main()
