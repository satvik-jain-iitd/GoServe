# Story #187 (H4): the database is the truth for a field's rules; the app and the Edge Functions mirror it. One test per rule, on the database.
# Every check ends in ROLLBACK (dev stays clean). Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it.
# The table of rules: docs/product/validation-rules.md. Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_validation.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

UID = "00000000-0000-0000-0000-0000000000d1"
KITCHEN = "11111111-1111-1111-1111-111111111111"
DISH = f"(select id from menu_items where kitchen_id = '{KITCHEN}' order by price_paise limit 1)"


def run(*stmts):
    return sql("begin; " + "; ".join(stmts) + "; rollback;")


def refused(r, word="violates check constraint"):
    return isinstance(r, dict) and word in str(r.get("error", ""))


def customer(**f):
    row = {"user_id": f"'{UID}'", "name": "'Asha'", "phone": "'9876543210'", "address": "'Flat 4'", "pin_code": "'110016'"}
    row.update({k: v for k, v in f.items()})
    return f"insert into customers ({', '.join(row)}) values ({', '.join(row.values())})"


def place(qty=1, address="'Flat 4, Green Park'"):
    total = f"((select price_paise from menu_items where id = {DISH}) * {qty})"
    lines = f"jsonb_build_array(jsonb_build_object('menu_item_id', {DISH}, 'qty', {qty}))"
    return (f"update kitchens set open = true, active = true, opens_at = null, closes_at = null where id = '{KITCHEN}'",
            f"select place_order_v2('{UID}', 'key-validation', '{KITCHEN}', {lines}, {address}, {total}, jsonb_build_object('to_pay_paise', {total})) as r")


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class Validation(unittest.TestCase):
    # ---- phone: ten digits, starts with 6, 7, 8 or 9 ----
    def test_phone_a_good_number_is_kept(self):
        self.assertIsInstance(run(customer()), list)

    def test_phone_must_be_ten_digits(self):
        self.assertTrue(refused(run(customer(phone="'98765'"))))

    def test_phone_must_start_with_6_to_9(self):
        self.assertTrue(refused(run(customer(phone="'5876543210'"))))

    def test_phone_letters_are_refused(self):
        self.assertTrue(refused(run(customer(phone="'abcdefghij'"))))

    def test_phone_the_code_sender_refuses_a_bad_number(self):
        r = run("select otp_send_v2('12345') as r")
        self.assertEqual(r[-1]["r"]["error"], "invalid_phone", r)

    # ---- name: 1 to 80 characters ----
    def test_name_81_characters_is_refused(self):
        self.assertTrue(refused(run(customer(name=f"'{'a' * 81}'"))))

    def test_name_empty_is_refused(self):
        self.assertTrue(refused(run(customer(name="''"))))

    # ---- address text: 1 to 300 characters ----
    def test_address_301_characters_is_refused_on_the_profile(self):
        self.assertTrue(refused(run(customer(address=f"'{'a' * 301}'"))))

    def test_address_empty_is_refused_by_the_order(self):
        r = run(*place(address="'   '"))
        self.assertEqual(r[-1]["r"]["error"], "invalid_address", r)

    def test_address_301_characters_is_refused_by_the_order(self):
        r = run(*place(address=f"'{'a' * 301}'"))
        self.assertTrue(refused(r) or (isinstance(r, list) and r[-1]["r"].get("error") == "invalid_address"), r)

    # ---- pin: six digits ----
    def test_pin_must_be_six_digits(self):
        self.assertTrue(refused(run(customer(pin_code="'1100'"))))
        self.assertTrue(refused(run(customer(pin_code="'11001a'"))))

    # ---- quantity of a dish: 1 to 20 ----
    def test_quantity_0_is_refused(self):
        self.assertEqual(run(*place(qty=0))[-1]["r"]["error"], "invalid_quantity")

    def test_quantity_21_is_refused(self):
        self.assertEqual(run(*place(qty=21))[-1]["r"]["error"], "invalid_quantity")

    # ---- coupon code: upper case, 2 to 40 characters ----
    COUPON = "insert into coupons (code, title, kind, ends_at) values ({code}, 'T', 'flat', now() + interval '1 day')"

    def test_coupon_code_lower_case_is_refused(self):
        self.assertTrue(refused(run(self.COUPON.format(code="'save10'"))))

    def test_coupon_code_41_characters_is_refused(self):
        self.assertTrue(refused(run(self.COUPON.format(code=f"'{'A' * 41}'"))))

    def test_coupon_code_one_character_is_refused(self):
        self.assertTrue(refused(run(self.COUPON.format(code="'A'"))))

    # ---- feedback text: 1 to 2000 characters (the app stops at 300) ----
    FEEDBACK = "insert into feedback (session_id, role, screen, doing, text) values ('s', 'customer', '/customer/', 'ordering', {text})"

    def test_feedback_empty_is_refused(self):
        self.assertTrue(refused(run(self.FEEDBACK.format(text="''"))))

    def test_feedback_2001_characters_is_refused(self):
        self.assertTrue(refused(run(self.FEEDBACK.format(text=f"'{'a' * 2001}'"))))


if __name__ == "__main__":
    unittest.main()
