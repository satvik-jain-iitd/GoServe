# Story #356 (E27, plan v2 B.20): run log on v2. Scenario: Given a call that fails, when the log is read, then the row has the error and a request id.
# Every v2 function writes one run_log row per call (supabase/functions/_shared/runlog.ts). The row needs a request id and a status, and no kitchen.
# Every check ends in ROLLBACK (dev stays clean). Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_run_log.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

ROW = "insert into run_log (workflow, session_id, request_id, status, duration_ms, error) values ('fn:orders', 'v2', 'req-0001', 409, 12, 'price_changed')"
ADMIN = "00000000-0000-0000-0000-0000000000a5"


def run(*stmts):
    r = sql("begin; " + "; ".join(stmts) + "; rollback;")
    assert isinstance(r, list), r
    return r[-1] if r else None


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class RunLog(unittest.TestCase):
    def test_a_failed_call_is_a_row_with_the_error_the_status_and_the_request_id_and_no_kitchen(self):
        r = run(ROW, "select workflow, status, error, request_id, kitchen_id from run_log where request_id = 'req-0001'")
        self.assertEqual(r, {"workflow": "fn:orders", "status": 409, "error": "price_changed", "request_id": "req-0001", "kitchen_id": None}, r)

    def test_a_request_id_finds_its_row_fast(self):
        r = run("select count(*) as n from pg_indexes where tablename = 'run_log' and indexdef like '%request_id%'")
        self.assertEqual(r, {"n": 1}, r)

    def test_today_s_rows_still_work_a_kitchen_row_with_no_request_id(self):
        r = run("insert into kitchens (id, name, pin_codes) values ('00000000-0000-0000-0000-0000000000b1', 'T', array['110016'])",
                "insert into run_log (kitchen_id, workflow, duration_ms) values ('00000000-0000-0000-0000-0000000000b1', 'GS SUB 14', 5)",
                "select request_id, status from run_log where workflow = 'GS SUB 14' and duration_ms = 5 order by id desc limit 1")
        self.assertEqual(r, {"request_id": None, "status": None}, r)

    def test_nobody_but_the_service_role_and_an_admin_can_read_the_log_and_nobody_but_the_service_role_writes(self):
        self.assertEqual(sql(f"begin; {ROW}; set local role anon; select count(*) as n from run_log where request_id = 'req-0001'; rollback;")[-1], {"n": 0})   # no policy: a stranger sees no row
        r = sql("begin; insert into auth.users (id) values ('" + ADMIN + "'); insert into admins (user_id) values ('" + ADMIN + "'); " + ROW + "; set local role authenticated; "
                f"select set_config('request.jwt.claims', '{{\"sub\":\"{ADMIN}\",\"role\":\"authenticated\"}}', true); select count(*) as n from run_log where request_id = 'req-0001'; rollback;")
        self.assertEqual(r[-1], {"n": 1}, r)
        w = sql("begin; set local role authenticated; select set_config('request.jwt.claims', '{\"sub\":\"" + ADMIN + "\",\"role\":\"authenticated\"}', true); " + ROW + "; rollback;")
        self.assertTrue("row-level security" in str(w) or "permission denied" in str(w), w)


if __name__ == "__main__":
    unittest.main()
