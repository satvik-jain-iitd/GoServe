# Story #347 (E27, plan v2 B.11): Place order v2. Scenario: Given a quote, when the order is placed twice with the same key, then one order exists;
# a changed price answers price_changed.
# The Edge Function does the quote; this function is the transaction: it checks the kitchen, the dishes, the add-on picks and the item total again,
# then writes the order and its event, or refuses with a code. It must also write what today's place_order writes (contract tests below).
# Every check ends in ROLLBACK (dev stays clean). Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_place_order_v2.py
import json, os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

K = "'00000000-0000-0000-0000-0000000000b1'"
D = "'00000000-0000-0000-0000-0000000000b2'"      # Thali 14000
D2 = "'00000000-0000-0000-0000-0000000000b3'"     # Chai 3000, sold out
G = "'00000000-0000-0000-0000-0000000000c1'"      # Extras: min 0, max 2
O1 = "'00000000-0000-0000-0000-0000000000e1'"     # Raita 2000
SETUP = [
    f"insert into kitchens (id, name, pin_codes) values ({K}, 'Test', array['110016'])",
    f"insert into menu_items (id, kitchen_id, name, price_paise) values ({D}, {K}, 'Thali', 14000)",
    f"insert into menu_items (id, kitchen_id, name, price_paise, available) values ({D2}, {K}, 'Chai', 3000, false)",
    f"insert into option_groups (id, menu_item_id, name, min_select, max_select) values ({G}, {D}, 'Extras', 0, 2)",
    f"insert into options (id, group_id, name, price_paise) values ({O1}, {G}, 'Raita', 2000)",
]
BILL = json.dumps({"item_total_paise": 32000, "fees": {"delivery_paise": 0, "packaging_paise": 0, "total_paise": 0}, "discount_paise": 0, "tax_paise": 0, "to_pay_paise": 32000})
LINES = json.dumps([{"menu_item_id": "00000000-0000-0000-0000-0000000000b2", "qty": 2, "option_ids": ["00000000-0000-0000-0000-0000000000e1"]}])


RES = "(select jsonb_agg(r order by i) from res)"   # the API answers only the last statement, so every call is kept in a temp table


def place(key="k1", session="s1", lines=LINES, item_total=32000, bill=BILL, kitchen=K, address="Flat 4, Green Park"):
    return f"insert into res (r) select place_order_v2('{session}', '{key}', {kitchen}, '{lines}'::jsonb, '{address}', {item_total}, '{bill}'::jsonb)"


def run(*stmts, final=""):
    """Runs the setup and the statements in one transaction; answers one row: rs (every place() answer, in order) plus the columns of `final`."""
    last = f"select {RES} as rs" + (", " + final if final else "")
    r = sql("begin; " + "; ".join(SETUP + ["create temp table res (i serial, r jsonb)"] + list(stmts) + [last]) + "; rollback;")
    assert isinstance(r, list), r
    return r[-1]


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class PlaceOrderV2(unittest.TestCase):
    def test_a_good_cart_makes_one_placed_order_with_the_price_and_the_bill_and_an_event(self):
        r = run(place(), final="(select row_to_json(x) from (select status, total_paise, address, bill->>'to_pay_paise' as pay, items->0->>'name' as name, items->0->>'price_paise' as unit, items->0->>'extras_paise' as extras from orders where session_id = 's1') x) as o, (select count(*) from order_events where session_id = 's1') as ev")
        v = r["rs"][0]
        self.assertEqual((v["ok"], v["created"], v["order"]["status"], v["order"]["total_paise"]), (True, True, "placed", 32000), v)
        self.assertEqual(r["o"], {"status": "placed", "total_paise": 32000, "address": "Flat 4, Green Park", "pay": "32000", "name": "Thali", "unit": "14000", "extras": "2000"}, r)
        self.assertEqual(r["ev"], 1)

    def test_the_same_key_twice_makes_one_order_and_answers_the_first_again(self):
        r = run(place(), place(), final="(select count(*) from orders where session_id = 's1') as n")
        a, b = r["rs"]
        self.assertEqual((a["created"], b["created"], b["order"]["id"] == a["order"]["id"]), (True, False, True))
        self.assertEqual(r["n"], 1)

    def test_a_changed_price_answers_price_changed_and_writes_nothing(self):
        r = run(f"update menu_items set price_paise = 15000 where id = {D}", place(), final="(select count(*) from orders where session_id = 's1') as n")
        self.assertEqual((r["rs"][0]["ok"], r["rs"][0]["error"]), (False, "price_changed"), r)
        self.assertEqual(r["n"], 0)

    def test_a_changed_add_on_price_answers_price_changed(self):
        r = run(f"update options set price_paise = 2500 where id = {O1}", place())
        self.assertEqual(r["rs"][0]["error"], "price_changed", r)

    def test_a_sold_out_dish_a_closed_kitchen_and_a_bad_add_on_pick_each_answer_their_own_code(self):
        sold = json.dumps([{"menu_item_id": "00000000-0000-0000-0000-0000000000b3", "qty": 1, "option_ids": []}])
        three = json.dumps([{"menu_item_id": "00000000-0000-0000-0000-0000000000b2", "qty": 1, "option_ids": ["00000000-0000-0000-0000-0000000000e1", "00000000-0000-0000-0000-0000000000e9"]}])
        self.assertEqual(run(place(lines=sold, item_total=3000))["rs"][0]["error"], "sold_out")
        self.assertEqual(run(f"update kitchens set open = false where id = {K}", place())["rs"][0]["error"], "kitchen_closed")
        self.assertEqual(run(place(lines=three, item_total=16000))["rs"][0]["error"], "unknown_option")

    def test_a_retry_of_a_placed_order_is_answered_even_when_the_kitchen_has_closed_since(self):
        r = run(place(), f"update kitchens set open = false where id = {K}", place())
        self.assertEqual((r["rs"][1]["ok"], r["rs"][1]["created"]), (True, False), r)

    def test_a_session_cannot_place_a_21st_order_in_a_day(self):
        r = run(*[place(key=f"k{i}") for i in range(21)])
        self.assertEqual([x["ok"] for x in r["rs"][:20]], [True] * 20)
        self.assertEqual(r["rs"][20]["error"], "session_order_cap", r["rs"][20])

    def test_a_missing_key_or_address_is_refused(self):
        self.assertEqual(run(place(key=""))["rs"][0]["error"], "invalid_request")
        self.assertEqual(run(place(address=" "))["rs"][0]["error"], "invalid_address")

    def test_contract_with_todays_place_order_a_cart_without_add_ons_writes_the_same_order(self):
        cart = json.dumps([{"menu_item_id": "00000000-0000-0000-0000-0000000000b2", "qty": 2}])
        plain = json.dumps([{"menu_item_id": "00000000-0000-0000-0000-0000000000b2", "qty": 2, "option_ids": []}])
        shape = ("(select row_to_json(x) from (select o.status, o.total_paise, o.address, o.items->0->>'menu_item_id' as dish, o.items->0->>'qty' as qty, o.items->0->>'price_paise' as unit, o.items->0->>'name' as name, "
                 "(select count(*) from order_events e where e.order_id = o.id and e.event = 'order.placed' and e.actor = 'customer') as ev from orders o where o.session_id = '{s}') x) as {n}")
        r = run(f"select place_order('s1', 'old', '{cart}'::jsonb, 'Flat 4, Green Park')",
                place(key="new", session="s2", lines=plain, item_total=28000, bill=json.dumps({"to_pay_paise": 28000})),
                final=shape.format(s="s1", n="old") + ", " + shape.format(s="s2", n="new"))
        self.assertEqual(r["old"], r["new"], r)
        self.assertEqual(r["new"]["total_paise"], 28000)

    def test_only_the_service_role_can_call_it(self):
        for role in ("anon", "authenticated"):
            r = sql("begin; " + "; ".join(SETUP) + f"; set local role {role}; select place_order_v2('s', 'k', {K}, '{LINES}'::jsonb, 'x', 32000, '{BILL}'::jsonb); rollback;")
            self.assertIn("permission denied", str(r), role)


if __name__ == "__main__":
    unittest.main()
