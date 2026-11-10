# Story #1329: the early-friend offer is an admin setting, on or off, with its amount. Default off. Every check ends in ROLLBACK. Red run: SKIP_MIG=1.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_early_friend_switch.py
import json, os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql, migration_inside
from test_place_order_v2 import K, D, SETUP, LINES, BILL, RES
from test_order_actions import ADMIN, OTHER, who
import test_early_friend as ef

MIG = migration_inside(["20261109130000_early_friend_followups.sql"], "to_regproc('public.early_friend_for') is not null")
SW = migration_inside(["20261110160000_early_friend_switch.sql"], "to_regproc('public.early_friend_set_v2') is not null")
U, PIN, FAR = ef.U, ef.PIN, ef.FAR
CURRENT = f"(select row_to_json(x) from (select offer_paise, offered_at is not null as stamped from area_requests where user_id = '{U}') x) as req"


def flatten(x):
    return [y for e in x for y in flatten(e)] if isinstance(x, list) else [x]


def run(*stmts, final=""):
    stmts = flatten(list(stmts))
    last = f"select {RES} as rs" + (", " + final if final else "")
    r = sql("begin; " + "; ".join(([MIG] if MIG else []) + ([SW] if SW else []) + SETUP + [f"insert into auth.users (id) values ('{ADMIN}'), ('{OTHER}') on conflict do nothing", f"insert into admins (user_id) values ('{ADMIN}')"] + ["create temp table res (i serial, r jsonb)", "grant all on res to public", "grant all on res_i_seq to public"] + list(stmts) + [last]) + "; rollback;")
    assert isinstance(r, list), r
    return r[-1] if isinstance(r, list) else r


def admin_set(on, amount, uid=ADMIN):
    return who(uid) + [f"select set_config('request.jwt.claim.sub', '{uid}', true)", f"insert into res (r) select early_friend_set_v2({str(on).lower()}, {amount})", "reset role"]


def tap_res(pin=FAR):
    return f"set local role authenticated; select set_config('request.jwt.claim.sub', '{U}', true); insert into res (r) select area_request_add_v2('{pin}'); reset role"


SETTING = "(select value from settings where name = 'early_friend') as setting"
LOGS = "(select count(*) from early_friend_log) as logs"


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class EarlyFriendSwitch(unittest.TestCase):
    def test_w1_the_default_is_off_with_rs_100(self):
        r = run(final=SETTING)
        self.assertEqual(r["setting"], {"on": False, "amount_paise": 10000}, r)

    def test_w2_off_the_tap_saves_the_request_and_promises_nothing(self):
        r = run(ef.CUSTOMER(FAR), tap_res(), final=CURRENT)
        self.assertEqual((r["rs"][0]["ok"], r["rs"][0]["offer_paise"], r["req"]), (True, None, {"offer_paise": None, "stamped": False}), r)

    def test_w3_on_with_an_amount_the_tap_promises_that_amount(self):
        r = run(admin_set(True, 5000), ef.CUSTOMER(FAR), tap_res(), final=CURRENT)
        self.assertEqual((r["rs"][1]["offer_paise"], r["req"]["offer_paise"]), (5000, 5000), r)

    def test_w4_only_an_admin_reads_or_sets_it(self):
        for steps in (admin_set(True, 5000, OTHER), who(OTHER) + ["select early_friend_get_v2()"]):
            with self.assertRaises(AssertionError) as e:
                run(steps)
            self.assertIn("not_admin", str(e.exception))

    def test_w5_an_amount_outside_rs_10_to_rs_500_is_refused_and_nothing_changes(self):
        for amount in (999, 50001, 0, -5):
            r = run(admin_set(True, amount), final=SETTING + ", " + LOGS)
            self.assertEqual((r["rs"][0]["error"], r["setting"]["on"], r["logs"]), ("invalid_amount", False, 0), (amount, r))

    def test_w6_every_real_change_is_logged_and_the_same_value_twice_logs_once(self):
        r = run(admin_set(True, 5000), admin_set(True, 5000), admin_set(False, 5000), final=LOGS)
        self.assertEqual(([x["changed"] for x in r["rs"]], r["logs"]), ([True, False, True], 2), r)

    def test_w7_a_promise_given_while_it_was_on_is_dropped_when_it_goes_off_and_the_first_order_pays_the_menu_price(self):
        r = run(admin_set(True, 10000), ef.CUSTOMER(), ef.tap(), admin_set(False, 10000), tap_res(PIN), ef.order("k1"), ef.order("k2", ef.GIFT), final=CURRENT + ", " + ef.TOTALS)
        self.assertEqual((r["rs"][2]["offer_paise"], r["rs"][3]["ok"], r["rs"][4]["error"], r["req"]["offer_paise"]), (None, True, "price_changed", None), r)
        self.assertEqual(r["t"], [{"total": 32000, "off": None, "pay": "32000"}], r)

    def test_w7b_turning_it_on_again_does_not_bring_the_old_promise_back(self):
        r = run(admin_set(True, 10000), ef.CUSTOMER(), ef.tap(), admin_set(False, 10000), admin_set(True, 5000), ef.order("k1", ef.GIFT), final=CURRENT)
        self.assertEqual((r["rs"][2]["changed"], r["rs"][3]["error"], r["req"]["offer_paise"]), (True, "price_changed", None), r)

    def test_w7c_a_promise_already_spent_stays_spent_and_a_cancel_while_it_is_off_does_not_give_it_back(self):
        r = run(admin_set(True, 10000), ef.CUSTOMER(), ef.tap(), ef.order("k1", ef.GIFT), admin_set(False, 10000), "reset role", f"update orders set status = 'cancelled' where client_order_key = 'k1'",
                final="(select offer_order_id is not null from area_requests where user_id = '" + U + "') as spent")
        self.assertEqual((r["rs"][0]["ok"], r["spent"]), (True, True), r)

    def test_w8_off_a_first_order_gets_no_gift_and_a_bill_that_claims_one_is_refused(self):
        r = run(ef.CUSTOMER(), tap_res(PIN), ef.order("k1"), ef.order("k2", ef.GIFT), final=ef.TOTALS)
        self.assertEqual((r["rs"][1]["ok"], r["rs"][2]["error"], r["t"]), (True, "price_changed", [{"total": 32000, "off": None, "pay": "32000"}]), r)

    def test_w9_a_person_who_tapped_while_it_was_off_gets_the_promise_when_it_is_on_and_they_tap_again(self):
        r = run(ef.CUSTOMER(FAR), tap_res(), admin_set(True, 5000), tap_res(), final=CURRENT)
        self.assertEqual((r["rs"][0]["offer_paise"], r["rs"][2]["offer_paise"], r["req"]["offer_paise"]), (None, 5000, 5000), r)


if __name__ == "__main__":
    unittest.main()
