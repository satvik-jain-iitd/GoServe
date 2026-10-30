"""Story #802: the number's owner is readable before a code is spent, and every stored number is in the 91 form.
Run: python3 scripts/test_otp_phone_owner.py          (reads goserve-dev; needs SUPABASE_ACCESS_TOKEN from the vault)
This is a live check, not a unit test: the rule it guards lives in the database, like scripts/test_otp.py."""
import json, os, sys, unittest, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vault as gsvault

DEV_REF = "tmxyizmkpwwfyazvrfhw"   # goserve-dev; prod is never read by a test


def sql(query, ref=DEV_REF):
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{ref}/database/query",
        data=json.dumps({"query": query}).encode(),
        headers={"Authorization": f"Bearer {gsvault.setting(os.environ, 'SUPABASE_ACCESS_TOKEN', '02_databases.env')}", "Content-Type": "application/json", "User-Agent": "goserve-otp-owner-test"},
    )
    return json.load(urllib.request.urlopen(req))


class PhoneOwner(unittest.TestCase):
    def test_the_function_exists_and_only_the_service_role_may_call_it(self):
        rows = sql("""select p.proname, p.prosecdef,
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

    def test_every_stored_number_is_in_the_ninety_one_form(self):
        left = sql("select count(*) as c from auth.users where phone ~ '^[6-9][0-9]{9}$'")[0]["c"]
        self.assertEqual(left, 0, "a number is stored as ten digits: Supabase phone sign-in cannot find that account")

    def test_an_unknown_number_has_no_owner(self):
        self.assertIsNone(sql("select otp_phone_owner('910000000000') as id")[0]["id"])


if __name__ == "__main__":
    unittest.main()
