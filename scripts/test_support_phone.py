# Story 1659 layer 1: one support phone number in settings, set by an admin, read by any signed-in user. Made-up number only: 9000000000.
# Every check ends in ROLLBACK (dev stays clean). Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_support_phone.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql


def run(*stmts):
    return sql("begin; " + "; ".join(stmts) + "; rollback;")


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class SupportPhone(unittest.TestCase):
    ADMIN = "00000000-0000-0000-0000-0000000000a9"
    NOBODY = "00000000-0000-0000-0000-0000000000b9"
    MAKE_ADMIN = f"insert into admins (user_id) values ('{ADMIN}')"
    SET = "update settings set value = '{}'::jsonb where name = 'support_phone'"

    def as_user(self, uid, body):
        return f"set local role authenticated; select set_config('request.jwt.claim.sub', '{uid}', true); {body}; reset role"

    def as_admin(self, body):
        return self.as_user(self.ADMIN, body)

    def test_the_row_exists_and_starts_at_json_null(self):
        r = run("select value, jsonb_typeof(value) as t from settings where name = 'support_phone'")
        self.assertEqual((r[-1]["value"], r[-1]["t"]), (None, "null"), r)

    def test_the_check_refuses_a_bad_value(self):
        for v in ('"900000000"', '"90000000001"', '"90000abcde"', '"5000000000"', "9000000000", "true"):
            self.assertIn("violates", str(run(self.SET.format(v))), v)

    def test_the_check_keeps_a_good_number(self):
        r = run(self.SET.format('"9000000000"'), "select value from settings where name = 'support_phone'")
        self.assertEqual(r[-1]["value"], "9000000000", r)

    def test_an_admin_sets_it_and_reads_it_back(self):
        r = run(self.MAKE_ADMIN, self.as_admin("create temp table s as select support_phone_set_v2('9000000000') as v"),
                self.as_admin("create temp table g as select support_phone_get_v2() as v"),
                "select (select v from s) as ans, (select v from g) as got, (select updated_by from settings where name = 'support_phone') as by")
        self.assertEqual(r[-1]["ans"], {"ok": True}, r)
        self.assertEqual(r[-1]["got"]["phone"], "9000000000", r)
        self.assertIn("updated_at", r[-1]["got"])
        self.assertEqual(r[-1]["by"], self.ADMIN, r)

    def test_get_says_null_when_not_set(self):
        r = run(self.MAKE_ADMIN, self.as_admin("create temp table g as select support_phone_get_v2() as v"), "select v from g")
        self.assertIsNone(r[-1]["v"]["phone"], r)

    def test_an_admin_clears_it_with_null_or_empty(self):
        for arg in ("null", "''", "'  '"):
            r = run(self.MAKE_ADMIN, self.as_admin("select support_phone_set_v2('9000000000')"),
                    self.as_admin(f"select support_phone_set_v2({arg})"), "select value from settings where name = 'support_phone'")
            self.assertIsNone(r[-1]["value"], (arg, r))

    def test_a_bad_number_returns_a_plain_message(self):
        for v in ("8000000", "90000000001", "5000000000", "90000abcde", "900000000"):
            r = run(self.MAKE_ADMIN, self.as_admin(f"create temp table s as select support_phone_set_v2('{v}') as v"), "select v from s")
            self.assertEqual(r[-1]["v"], {"ok": False, "error": "invalid_phone", "message": "Type a 10-digit mobile number."}, (v, r))

    def test_a_customer_cannot_set_or_get_through_the_admin_functions(self):
        for call in ("support_phone_set_v2('9000000000')", "support_phone_get_v2()"):
            r = run(self.as_user(self.NOBODY, f"select {call}"))
            self.assertIn("not_admin", str(r), call)

    def test_a_signed_in_customer_reads_the_number(self):
        r = run(self.MAKE_ADMIN, self.as_admin("select support_phone_set_v2('9000000000')"),
                self.as_user(self.NOBODY, "create temp table c as select support_phone() as v"), "select v from c")
        self.assertEqual(r[-1]["v"], "9000000000", r)

    def test_a_customer_reads_null_when_not_set(self):
        r = run(self.as_user(self.NOBODY, "create temp table c as select support_phone() as v"), "select v from c")
        self.assertIsNone(r[-1]["v"], r)

    def test_the_signed_out_cannot_call_any_of_them(self):
        for call in ("support_phone()", "support_phone_get_v2()", "support_phone_set_v2('9000000000')"):
            self.assertIn("permission denied", str(run("set local role anon", f"select {call}")), call)

    def test_a_customer_cannot_read_other_settings_through_it(self):
        r = run(self.as_user(self.NOBODY, "create temp table c as select support_phone() as v, pg_typeof(support_phone()) as t"), "select v, t from c")
        self.assertEqual(r[-1]["t"], "text", r)
        self.assertNotIn("updated_by", str(r))
        # the table's own policy hides the row from a customer (empty, not an error)
        r = run("set local role authenticated", "select value from settings where name = 'support_phone'")
        self.assertEqual(r[-1:], [], r)


if __name__ == "__main__":
    unittest.main()
