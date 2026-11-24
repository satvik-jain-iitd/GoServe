# Story #944 (otp_codes retention): the login codes hold phone numbers, so rows consumed or expired more than 24 hours ago are deleted by a named daily job.
# A row that is still live, or spent less than 24 hours ago, stays (the 3-in-10-minutes send limit and the verify check never read anything older than 10 minutes).
# Every check ends in ROLLBACK (dev stays clean). SKIP_MIG=1 runs against the database as it is (the red run before the migration).
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_otp_purge.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

HERE = os.path.dirname(os.path.abspath(__file__))
MIG = "" if os.environ.get("SKIP_MIG") else open(os.path.join(HERE, "..", "supabase", "migrations", "20261124200000_otp_purge.sql")).read()
ROWS = [
    "insert into otp_codes (phone, code_hash, expires_at, consumed_at) values ('919000000001', 'old-spent', now() - interval '30 hours', now() - interval '29 hours')",
    "insert into otp_codes (phone, code_hash, expires_at) values ('919000000002', 'old-expired', now() - interval '25 hours')",
    "insert into otp_codes (phone, code_hash, expires_at, consumed_at) values ('919000000003', 'new-spent', now() + interval '9 minutes', now() - interval '1 hour')",
    "insert into otp_codes (phone, code_hash, expires_at) values ('919000000004', 'new-expired', now() - interval '2 hours')",
    "insert into otp_codes (phone, code_hash, expires_at) values ('919000000005', 'live', now() + interval '9 minutes')",
]


def run(*stmts):
    r = sql("begin; " + MIG + "; " + "; ".join(stmts) + "; rollback;")
    return r[-1] if isinstance(r, list) else r


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class OtpPurge(unittest.TestCase):
    def test_o1_only_rows_spent_or_expired_over_24_hours_ago_go(self):
        r = run(*ROWS, "create temp table n as select otp_purge_v2() as n",
                "select (select n from n) as gone, (select array_agg(code_hash order by code_hash) from otp_codes where phone like '91900000000_') as kept")
        self.assertGreaterEqual(r["gone"], 2, r)   # dev holds other old rows too
        self.assertEqual(r["kept"], ["live", "new-expired", "new-spent"], r)

    def test_o2_a_named_daily_job_runs_it(self):
        r = run("select jobname, schedule, command from cron.job where jobname = 'goserve-otp-purge'")
        self.assertEqual(r["schedule"], "17 3 * * *", r)
        self.assertIn("otp_purge_v2", r["command"], r)

    def test_o3_nobody_but_the_server_can_call_it(self):
        for role in ("anon", "authenticated"):
            self.assertIn("permission denied", str(run(f"set local role {role}", "select otp_purge_v2()")), role)


if __name__ == "__main__":
    unittest.main()
