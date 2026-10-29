# Story #619 layer b: the admin's settings table. One row now: swap_discount_pct (0 to 50, default 10). Service role writes; nobody else reads or writes.
# Every check ends in ROLLBACK (dev stays clean). Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_settings.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql


def run(*stmts):
    return sql("begin; " + "; ".join(stmts) + "; rollback;")


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class Settings(unittest.TestCase):
    def test_the_swap_discount_starts_at_10(self):
        r = run("select value from settings where name = 'swap_discount_pct'")
        self.assertEqual(r[-1]["value"], 10, r)

    def test_a_value_from_0_to_50_is_kept(self):
        for v in (0, 25, 50):
            r = run(f"update settings set value = '{v}'::jsonb, updated_at = now() where name = 'swap_discount_pct'", "select value from settings where name = 'swap_discount_pct'")
            self.assertEqual(r[-1]["value"], v, r)

    def test_a_value_outside_0_to_50_or_not_a_whole_number_is_refused(self):
        for v in ("51", "-1", "10.5", '"ten"', "null"):
            r = run(f"update settings set value = '{v}'::jsonb where name = 'swap_discount_pct'")
            self.assertIn("violates", str(r), v)

    def test_nobody_but_the_service_role_can_read_or_write(self):
        for who in ("set local role anon", "set local role authenticated"):
            self.assertIn("permission denied", str(run(who, "select * from settings")), who)
            self.assertIn("permission denied", str(run(who, "update settings set value = '50'::jsonb")), who)

    def test_a_name_is_one_row(self):
        self.assertIn("duplicate key", str(run("insert into settings (name, value) values ('swap_discount_pct', '5'::jsonb)")))


    # Story #619 layer d (board A9): the admin reads and changes the percent through two functions; nobody else can.
    ADMIN = "00000000-0000-0000-0000-0000000000a9"
    NOBODY = "00000000-0000-0000-0000-0000000000b9"

    def as_user(self, uid, body):
        return f"set local role authenticated; select set_config('request.jwt.claim.sub', '{uid}', true); {body}; reset role"

    def test_an_admin_reads_the_percent_and_who_set_it(self):
        r = run(f"insert into admins (user_id) values ('{self.ADMIN}')", self.as_user(self.ADMIN, "create temp table g as select swap_discount_get_v2() as v"), "select v from g")
        self.assertEqual(r[-1]["v"]["pct"], 10, r)
        self.assertIn("updated_at", r[-1]["v"])

    def test_an_admin_changes_the_percent_and_it_is_stamped(self):
        r = run(f"insert into admins (user_id) values ('{self.ADMIN}')", self.as_user(self.ADMIN, "create temp table s as select swap_discount_set_v2(25) as v"),
                "select (select v from s) as ans, (select value from settings where name = 'swap_discount_pct') as val, (select updated_by from settings where name = 'swap_discount_pct') as by")
        self.assertEqual((r[-1]["ans"], r[-1]["val"], r[-1]["by"]), ({"ok": True}, 25, self.ADMIN), r)

    def test_a_percent_outside_0_to_50_is_refused_with_a_plain_line(self):
        for v in ("51", "-1", "null"):
            r = run(f"insert into admins (user_id) values ('{self.ADMIN}')", self.as_user(self.ADMIN, f"create temp table s as select swap_discount_set_v2({v}) as v"), "select v from s")
            self.assertEqual(r[-1]["v"]["error"], "invalid_percent", (v, r))
            self.assertEqual(r[-1]["v"]["message"], "Pick a whole number from 0 to 50.")

    def test_someone_who_is_not_an_admin_cannot_read_or_change_it(self):
        for call in ("swap_discount_get_v2()", "swap_discount_set_v2(30)"):
            r = run(self.as_user(self.NOBODY, f"select {call}"))
            self.assertIn("not_admin", str(r), call)

    def test_the_signed_out_cannot_call_them(self):
        for call in ("swap_discount_get_v2()", "swap_discount_set_v2(30)"):
            self.assertIn("permission denied", str(run("set local role anon", f"select {call}")), call)


if __name__ == "__main__":
    unittest.main()
