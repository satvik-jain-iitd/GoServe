# Story 1773 (epic 1753, owner 22 Nov 2026): an open app keeps the fee it loaded for up to 12 hours. delivery_fee_at_v1(as_of) gives the fee live at a time.
# Every check ends in ROLLBACK (dev stays clean). now() is fixed inside one transaction, so the 12 hour edge is exact. SKIP_MIG=1 runs without the migration (the red run).
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_delivery_fee_at.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

HERE = os.path.dirname(os.path.abspath(__file__))
FILE = os.path.join(HERE, "..", "supabase", "migrations", "20261123100000_delivery_fee_at.sql")
MIG = "" if os.environ.get("SKIP_MIG") else open(FILE).read()


def run(rows, settings, *stmts):
    """rows: [(amount_paise, hours_ago)] become the whole log; settings: the live value in paise."""
    ins = [f"insert into delivery_fee_log (amount_paise, at) values ({a}, now() - interval '{h} hours')" for a, h in rows]
    return sql("begin; " + (MIG + "; " if MIG else "") + "; ".join(["delete from delivery_fee_log"] + ins
               + [f"update settings set value = jsonb_build_object('amount_paise', {settings}) where name = 'delivery_fee'"] + list(stmts)) + "; rollback;")


def at(arg):   # the amount, the time the server used as hours before now (rounded to a second), and whether the answer carries a name
    a = "null" if arg is None else f"now() - interval '{arg}'"
    return (f"select (r ->> 'amount_paise')::int as amount, round(extract(epoch from (now() - (r ->> 'as_of')::timestamptz)))::int as ago_s, "
            f"(r ->> 'now')::timestamptz = now() as now_ok, r::text ~ 'by_' as has_name from (select delivery_fee_at_v1({a}) as r) x")


H = 3600
LOG = [(2000, 20), (4000, 12), (0, 5)]   # 2000 twenty hours ago, 4000 twelve hours ago (exactly the edge), 0 five hours ago


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class DeliveryFeeAt(unittest.TestCase):
    def test_ac1_no_time_gives_the_live_fee_and_now(self):
        r = run(LOG, 0, at(None))[-1]
        self.assertEqual((r["amount"], r["ago_s"], r["now_ok"]), (0, 0, True), r)

    def test_ac2_a_time_before_the_last_change_gives_the_fee_live_then(self):
        self.assertEqual(run(LOG, 0, at("6 hours"))[-1]["amount"], 4000)

    def test_ac3_the_edge_is_inclusive_and_older_is_clamped_to_12_hours_never_older(self):
        r = run(LOG, 0, at("12 hours"))[-1]
        self.assertEqual((r["amount"], r["ago_s"]), (4000, 12 * H), r)
        for older in ("12 hours 1 second", "20 hours", "3 days"):
            r = run(LOG, 0, at(older))[-1]
            self.assertEqual((r["amount"], r["ago_s"]), (4000, 12 * H), (older, r))   # the fee at now - 12 h, and the time the server used says so

    def test_ac4_a_time_in_the_future_is_now(self):
        r = run(LOG, 0, at("-1 hours"))[-1]
        self.assertEqual((r["amount"], r["ago_s"]), (0, 0), r)

    def test_ac5_before_the_first_log_row_the_fee_is_0(self):
        self.assertEqual(run([(500, 5)], 500, at("6 hours"))[-1]["amount"], 0)

    def test_ac5_the_two_paths_agree_after_a_direct_edit_of_settings(self):
        # settings says 3000 but the last log row (5 hours ago) says 0: a time after that row answers the settings value, the same as no time
        r = run(LOG, 3000, "select (delivery_fee_at_v1(null) ->> 'amount_paise')::int as no_time, (delivery_fee_at_v1(now() - interval '1 hours') ->> 'amount_paise')::int as after_last")[-1]
        self.assertEqual(r, {"no_time": 3000, "after_last": 3000}, r)
        self.assertEqual(run(LOG, 3000, at("4 hours"))[-1]["amount"], 3000)   # a time just after the last row too
        self.assertEqual(run(LOG, 3000, at("6 hours"))[-1]["amount"], 4000)   # a newer row exists: the log value live then

    def test_ac6_customers_and_guests_may_run_it_and_the_answer_has_no_name(self):
        for role in ("anon", "authenticated"):
            r = run(LOG, 0, f"set local role {role}", at("6 hours"))[-1]
            self.assertEqual((r["amount"], r["has_name"]), (4000, False), (role, r))

    def test_ac6_it_is_closed_to_the_public_role_grant_only_anon_and_authenticated(self):
        r = run(LOG, 0, "select has_function_privilege('anon', 'delivery_fee_at_v1(timestamptz)', 'execute') as a, "
                "has_function_privilege('authenticated', 'delivery_fee_at_v1(timestamptz)', 'execute') as u")[-1]
        self.assertEqual(r, {"a": True, "u": True})

    def test_ac7_the_12_hours_is_one_named_value_with_the_owners_date(self):
        text = open(FILE).read()
        self.assertEqual(text.count("interval '12 hours'"), 1)
        self.assertIn("22 Nov 2026", text)

    def test_the_migration_file_runs_twice_without_error(self):
        if not MIG:
            self.skipTest("SKIP_MIG")
        self.assertTrue(sql("begin; " + MIG + "; " + MIG + "; rollback;") is not None)
