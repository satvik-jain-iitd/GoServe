# Story #339 (E27, plan v2 B.3): phone OTP login, built with a TEST DOUBLE (FakeSms) until the owner picks and clicks the SMS provider.
# Scenario: Given a phone number, when the code is right, then it is accepted once; a wrong or old code is not.
# The database holds the rules: 3 sends per phone per 10 minutes, 5 tries per code, 10 minutes of life, one use. The code is kept only as a hash.
# otp_send_v2 hands the plain code to the Edge Function (service role) so a sender can deliver it; the FakeSms sender delivers nothing.
# Every check ends in ROLLBACK (dev stays clean). Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_otp.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

P = "9876543210"
P2 = "9876543211"
SETUP = ["create temp table res (i serial, r jsonb)"]


def send(phone=P):
    return f"insert into res (r) select otp_send_v2('{phone}')"


def verify(code, phone=P):
    return f"insert into res (r) select otp_verify_v2('{phone}', '{code}')"


# the code of the nth send, read back from the answers, is spliced in by a second statement
def verify_last(phone=P, nth=None):
    pick = "(select r->>'code' from res where r ? 'code' order by i " + ("desc limit 1" if nth is None else f"limit 1 offset {nth}") + ")"
    return f"insert into res (r) select otp_verify_v2('{phone}', {pick})"


def run(*steps, final=""):
    flat = [s for st in steps for s in (st if isinstance(st, list) else [st])]
    last = "select (select jsonb_agg(r order by i) from res) as rs" + (", " + final if final else "")
    r = sql("begin; " + "; ".join(SETUP + flat + [last]) + "; rollback;")
    assert isinstance(r, list), r
    return r[-1]


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class Otp(unittest.TestCase):
    def test_a_send_answers_a_six_digit_code_and_keeps_only_its_hash_for_10_minutes(self):
        r = run(send(), final="(select count(*) from otp_codes where code_hash = (select r->>'code' from res limit 1) or code_hash !~ '^[0-9a-f]{64}$') as plain, "
                              "(select count(*) from otp_codes where phone = '919876543210' and expires_at between now() + interval '9 minutes 50 seconds' and now() + interval '10 minutes 10 seconds') as ten")
        a = r["rs"][0]
        self.assertEqual((a["ok"], len(a["code"]), a["code"].isdigit(), a["expires_in_s"]), (True, 6, True, 600), a)
        self.assertEqual((r["plain"], r["ten"]), (0, 1), r)

    def test_the_right_code_is_accepted_once_and_the_phone_is_returned_in_full_form(self):
        r = run(send(), verify_last(), verify_last())
        a, b = r["rs"][1], r["rs"][2]
        self.assertEqual((a["ok"], a["phone"]), (True, "919876543210"), a)
        self.assertEqual((b["ok"], b["error"]), (False, "no_code"), b)

    def test_a_wrong_code_counts_and_the_fifth_wrong_try_burns_the_code(self):
        r = run(send(), *[verify("not-it") for _ in range(5)], verify_last(), final="")
        errs = [x.get("error") for x in r["rs"][1:6]]
        self.assertEqual(errs, ["wrong_code"] * 5, r["rs"])
        self.assertEqual(r["rs"][5]["attempts_left"], 0)
        self.assertEqual(r["rs"][6]["error"], "too_many_attempts", r["rs"][6])   # even the right code is refused now

    def test_an_expired_code_is_refused(self):
        r = run(send(), "update otp_codes set expires_at = now() - interval '1 second' where phone = '919876543210'", verify_last())
        self.assertEqual(r["rs"][1]["error"], "code_expired", r["rs"])

    def test_the_fourth_send_in_10_minutes_is_refused_for_that_phone_only_and_allowed_again_later(self):
        r = run(send(), send(), send(), send(), send(P2),
                "update otp_codes set created_at = now() - interval '11 minutes' where phone = '919876543210'", send())
        self.assertEqual([x["ok"] for x in r["rs"]], [True, True, True, False, True, True])
        self.assertEqual(r["rs"][3]["error"], "too_many_sends")

    def test_a_newer_send_replaces_the_older_code(self):
        r = run(send(), send(), verify_last(nth=0))
        self.assertEqual(r["rs"][2]["error"], "wrong_code", r["rs"])   # the first code is void once a second one is sent

    def test_a_phone_that_is_not_an_indian_mobile_is_refused(self):
        for bad in ("12345", "5876543210", "98765432101", "98765abcde", ""):
            self.assertEqual(run(send(bad))["rs"][0]["error"], "invalid_phone", bad)

    def test_only_the_service_role_can_call_them_or_read_the_table(self):
        for role in ("anon", "authenticated"):
            for stmt in (f"select otp_send_v2('{P}')", f"select otp_verify_v2('{P}', '123456')", "select count(*) from otp_codes"):
                r = sql("begin; " + f"set local role {role}; " + stmt + "; rollback;")
                self.assertIn("permission denied", str(r), (role, stmt))


if __name__ == "__main__":
    unittest.main()
