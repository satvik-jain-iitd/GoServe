# Story #351 (E27, plan v2 B.15): push to phones on a TEST DOUBLE (FakePush) until the owner's FCM and Apple Developer clicks.
# Scenario: Given a device token, when an order changes, then a push is sent to Android or iOS.
# The database holds the device tokens (one row per device) and answers "who to push for this order"; the senders are in supabase/functions/push.
# Every check ends in ROLLBACK (dev stays clean). Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_push_devices.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql
from test_payments import O, CUST, OTHER, SETUP, q, run

N = "(select count(*) from push_devices) as n"


def reg(platform="android", token="tok-a", session=CUST):
    return q(f"register_push_device_v2('{session}', '{platform}', '{token}')")


def job(order=O):
    return q(f"push_job_v2('{order}')")


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class PushDevices(unittest.TestCase):
    def test_a_device_registers_once_and_the_job_for_its_order_names_it(self):
        r = run(reg(), reg(), reg("ios", "tok-i"), job(), final=N)
        self.assertEqual((r["rs"][0]["ok"], r["n"]), (True, 2), r)   # the same token twice is one row
        self.assertEqual(r["rs"][3]["status"], "placed", r)
        self.assertEqual(sorted((d["platform"], d["token"]) for d in r["rs"][3]["devices"]), [("android", "tok-a"), ("ios", "tok-i")], r)

    def test_a_token_that_moves_to_another_user_follows_the_new_user(self):
        r = run(reg(), reg(session=OTHER), job(), final=N)
        self.assertEqual((r["n"], r["rs"][2]["devices"]), (1, []), r)   # the old owner no longer gets pushes for the token

    def test_a_bad_platform_or_an_empty_token_is_refused_and_stores_nothing(self):
        r = run(reg("windows"), reg("android", " "), final=N)
        self.assertEqual([x["error"] for x in r["rs"]], ["invalid_request", "invalid_request"], r)
        self.assertEqual(r["n"], 0)

    def test_the_job_for_an_unknown_order_is_refused(self):
        r = run(job("00000000-0000-0000-0000-00000000dead"))
        self.assertEqual(r["rs"][0]["error"], "order_not_found", r)

    def test_a_dead_token_is_forgotten(self):
        r = run(reg(), q("push_device_forget_v2('tok-a')"), final=N)
        self.assertEqual(r["n"], 0, r)

    def test_only_the_service_role_can_call_them_and_nobody_reads_the_table(self):
        for role in ("anon", "authenticated"):
            for stmt in (f"select register_push_device_v2('{CUST}', 'android', 'x')", f"select push_job_v2('{O}')", "select push_device_forget_v2('x')", "select count(*) from push_devices"):
                r = sql("begin; " + "; ".join(SETUP + [f"set local role {role}", stmt]) + "; rollback;")
                self.assertIn("permission denied", str(r), (role, stmt))


if __name__ == "__main__":
    unittest.main()
