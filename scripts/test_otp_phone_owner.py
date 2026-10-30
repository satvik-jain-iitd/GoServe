# Story #802: the number's owner is readable before a code is spent, and every stored number is in the 91 form.
# Scenario: Given a number that already has an account, when a code is asked for, then the owner is known without consuming a code.
# The rule lives in the database (otp_phone_owner), so this check runs against goserve-dev, like scripts/test_otp.py.
# Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped when it is not set (CI has none).
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_otp_phone_owner.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class PhoneOwner(unittest.TestCase):
    def test_s1_the_function_exists_and_only_the_service_role_may_call_it(self):
        rows = sql("""select p.prosecdef,
                        has_function_privilege('anon', p.oid, 'execute') as anon,
                        has_function_privilege('authenticated', p.oid, 'execute') as authed,
                        has_function_privilege('service_role', p.oid, 'execute') as service
                      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                      where n.nspname = 'public' and p.proname = 'otp_phone_owner'""")
        self.assertEqual(len(rows), 1, "otp_phone_owner is missing")
        self.assertTrue(rows[0]["prosecdef"], "must be security definer to read auth.users")
        self.assertFalse(rows[0]["anon"])
        self.assertFalse(rows[0]["authed"])
        self.assertTrue(rows[0]["service"])

    def test_s2_an_unknown_number_has_no_owner(self):
        self.assertIsNone(sql("select otp_phone_owner('910000000000') as id")[0]["id"])

    def test_s3_every_stored_number_is_in_the_ninety_one_form(self):
        # A ten digit number in auth.users is a number Supabase's own phone sign-in cannot find, so that customer cannot get back in.
        left = sql("select count(*) as c from auth.users where phone ~ '^[6-9][0-9]{9}$'")[0]["c"]
        self.assertEqual(left, 0, "a number is stored as ten digits: Supabase phone sign-in cannot find that account")


if __name__ == "__main__":
    unittest.main()
