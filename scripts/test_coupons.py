# Story #346 (layer 1, E27 plan v2 B.10): coupons. The server decides which coupon is valid now: active, inside its dates, under its max uses.
# Scenario: Given several valid coupons, when a quote is asked, then the best one is applied and the list is returned. (The choice is in supabase/functions/quote; this file is the database half.)
# Every check ends in ROLLBACK (dev stays clean). Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_coupons.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql
from test_payments import O, SETUP, q, run


def coupon(code, **kw):
    f = {"title": f"{code} offer", "kind": "flat", "amount_paise": 5000, "percent": 0, "cap_paise": 0, "min_order_paise": 0, "first_order_only": False,
         "starts_at": "now() - interval '1 day'", "ends_at": "now() + interval '1 day'", "max_uses": "null", "active": "true", **kw}
    txt = lambda k: f"'{f[k]}'" if k in ("title", "kind") else str(f[k])
    return (f"insert into coupons (code, title, kind, amount_paise, percent, cap_paise, min_order_paise, first_order_only, starts_at, ends_at, max_uses, active) values "
            f"('{code}', {txt('title')}, {txt('kind')}, {f['amount_paise']}, {f['percent']}, {f['cap_paise']}, {f['min_order_paise']}, {f['first_order_only']}, {f['starts_at']}, {f['ends_at']}, {f['max_uses']}, {f['active']})")


def valid():
    return q("coupons_valid_v2()")


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class Coupons(unittest.TestCase):
    def codes(self, r, i=0):
        return sorted(c["code"] for c in r["rs"][i])

    def test_only_a_valid_coupon_is_listed(self):
        r = run(coupon("GOOD"), coupon("OFF", active="false"), coupon("OLD", ends_at="now() - interval '1 hour'"), coupon("SOON", starts_at="now() + interval '1 hour'"), valid())
        self.assertEqual(self.codes(r, 0), ["GOOD"], r)

    def test_a_coupon_used_up_is_not_listed(self):
        used = f"update orders set bill = '{{\"item_total_paise\": 28000, \"to_pay_paise\": 28000, \"coupon\": {{\"code\": \"ONCE\"}}}}' where id = '{O}'"
        r = run(coupon("ONCE", max_uses="1"), coupon("TWICE", max_uses="2"), valid(), used, valid())
        self.assertEqual((self.codes(r, 0), self.codes(r, 1)), (["ONCE", "TWICE"], ["TWICE"]), r)

    def test_a_coupon_is_found_by_its_code_in_any_case_and_only_when_valid(self):
        r = run(coupon("SAVE5"), coupon("DEAD", active="false"), q("coupon_by_code_v2('save5')"), q("coupon_by_code_v2('DEAD')"), q("coupon_by_code_v2('NOPE')"))
        self.assertEqual(r["rs"][0]["code"], "SAVE5", r)
        self.assertEqual((r["rs"][1], r["rs"][2]), (None, None), r)

    def test_the_answer_has_what_the_quote_needs_and_nothing_secret(self):
        r = run(coupon("PCT", kind="percent", amount_paise=0, percent=10, cap_paise=3000, min_order_paise=20000, first_order_only="true"), valid())
        self.assertEqual(r["rs"][0][0], {"code": "PCT", "title": "PCT offer", "kind": "percent", "amount_paise": 0, "percent": 10, "cap_paise": 3000, "min_order_paise": 20000, "first_order_only": True}, r)

    def test_a_code_is_unique_and_the_numbers_make_sense(self):
        for bad in (coupon("A") + "; " + coupon("A"), coupon("B", kind="percent", percent=0, amount_paise=0), coupon("C", amount_paise=0), coupon("D", ends_at="now() - interval '2 days'")):
            r = sql("begin; " + "; ".join(SETUP + [bad]) + "; rollback;")
            self.assertTrue("error" in r or "violates" in str(r), (bad, r))

    def test_nobody_reads_or_writes_the_table_and_only_the_service_role_calls_the_functions(self):
        for role in ("anon", "authenticated"):
            for stmt in ("select count(*) from coupons", "select coupons_valid_v2()", "select coupon_by_code_v2('x')"):
                r = sql("begin; " + "; ".join(SETUP + [f"set local role {role}", stmt]) + "; rollback;")
                self.assertIn("permission denied", str(r), (role, stmt))


if __name__ == "__main__":
    unittest.main()


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class PersonalCoupons(unittest.TestCase):
    # Story #579: coupon_by_code_v2 knows the caller's session. A personal coupon is found by its own customer only.
    def mine(self, code, session):
        return coupon(code).replace("max_uses, active) values", "max_uses, active, session_id) values").rstrip(")") + f", '{session}')"

    def test_a_personal_coupon_is_found_by_its_own_session_only(self):
        r = run(self.mine("LATE-TEST0001", "sess-a"), q("coupon_by_code_v2('late-test0001', 'sess-a')"), q("coupon_by_code_v2('LATE-TEST0001', 'sess-b')"),
                q("coupon_by_code_v2('LATE-TEST0001')"), q("coupon_by_code_v2('LATE-TEST0001', null)"))
        self.assertEqual(r["rs"][0]["code"], "LATE-TEST0001", r)
        self.assertEqual(r["rs"][1:4], [None, None, None], r)

    def test_a_public_coupon_is_found_with_or_without_a_session(self):
        r = run(coupon("PUB5"), q("coupon_by_code_v2('PUB5')"), q("coupon_by_code_v2('pub5', 'sess-a')"))
        self.assertEqual([x["code"] for x in r["rs"]], ["PUB5", "PUB5"], r)
