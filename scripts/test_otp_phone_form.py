# Story #802a: every stored number is in the 91 form. A ten digit number in auth.users is a number Supabase's own phone sign-in cannot find.
# Scenario: Given an account stored as ten digits, when the repair has run, then the number is 91 plus the ten digits and sign-in can find it.
# Runs against goserve-dev, like scripts/test_otp.py. Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped when it is not set (CI has none).
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_otp_phone_form.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class PhoneForm(unittest.TestCase):
    def test_s1_only_the_service_role_may_run_the_repair(self):
        rows = sql("""select has_function_privilege('anon', p.oid, 'execute') as anon,
                        has_function_privilege('authenticated', p.oid, 'execute') as authed,
                        has_function_privilege('service_role', p.oid, 'execute') as service
                      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                      where n.nspname = 'public' and p.proname = 'otp_repair_phone_form'""")
        self.assertEqual(len(rows), 1, "otp_repair_phone_form is missing")
        self.assertEqual((rows[0]["anon"], rows[0]["authed"], rows[0]["service"]), (False, False, True))

    def test_s2_every_stored_number_is_in_the_ninety_one_form(self):
        # The one exception is a pair where the 91 form already exists: both rows are left alone (the owner's call).
        left = sql("""select count(*) as c from auth.users u where u.phone ~ '^[6-9][0-9]{9}$'
                      and not exists (select 1 from auth.users o where o.phone = '91' || u.phone)""")[0]["c"]
        self.assertEqual(left, 0, "a number is stored as ten digits: Supabase phone sign-in cannot find that account")


if __name__ == "__main__":
    unittest.main()
