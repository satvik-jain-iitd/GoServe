# Story #848 (epic E32): the Simulator seeds the kitchens and the riders as two groups, and "Clear everything" empties the dev city.
# Every check ends in ROLLBACK (dev stays clean). The migration is run inside each transaction first, so this passes before and after it is applied.
# SKIP_MIG=1 runs against the database as it is (the red run before the migration).
# Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_sim_groups.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

MIG = "" if os.environ.get("SKIP_MIG") else open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "supabase", "migrations", "20261104120000_sim_groups.sql")).read()


def run(*stmts):
    return sql("begin; " + MIG + "; " + "; ".join(stmts) + "; rollback;")


def counts():
    return "select (select count(*) from kitchens where synthetic) as k, (select count(*) from riders where synthetic) as r, (select count(*) from menu_items where synthetic) as d"


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class SimGroups(unittest.TestCase):
    def test_seed_the_kitchens_adds_kitchens_and_dishes_and_no_riders(self):
        r = run("select sim_reset()", "select sim_seed('{\"part\":\"kitchens\"}'::jsonb)", counts())
        self.assertEqual((r[-1]["k"], r[-1]["r"], r[-1]["d"]), (10, 0, 120), r)

    def test_seed_the_riders_adds_riders_and_leaves_the_kitchens_alone(self):
        r = run("select sim_reset()", "select sim_seed('{\"part\":\"kitchens\"}'::jsonb)", "select sim_seed('{\"part\":\"riders\",\"riders_per_kitchen\":3}'::jsonb)", counts())
        self.assertEqual((r[-1]["k"], r[-1]["r"], r[-1]["d"]), (10, 30, 120), r)

    def test_seed_the_riders_alone_does_not_make_kitchens(self):
        r = run("select sim_reset()", "select sim_seed('{\"part\":\"riders\",\"riders_per_kitchen\":2}'::jsonb)", counts())
        self.assertEqual((r[-1]["k"], r[-1]["r"], r[-1]["d"]), (0, 20, 0), r)

    def test_no_part_still_seeds_both(self):
        r = run("select sim_reset()", "select sim_seed('{\"riders_per_kitchen\":2}'::jsonb)", counts())
        self.assertEqual((r[-1]["k"], r[-1]["r"], r[-1]["d"]), (10, 20, 120), r)

    def test_the_status_says_how_many_are_real_and_that_clear_is_not_allowed_without_the_row(self):
        r = run("delete from settings where name = 'clear_allowed'", "select sim_status() as s")
        s = r[-1]["s"]
        self.assertEqual(s["clear_allowed"], False, s)
        self.assertIn("kitchens_real", s); self.assertIn("riders_real", s)

    def test_the_status_says_clear_is_allowed_when_the_dev_row_is_true(self):
        r = run("insert into settings (name, value) values ('clear_allowed', 'true'::jsonb) on conflict (name) do update set value = 'true'::jsonb", "select sim_status() as s")
        self.assertEqual(r[-1]["s"]["clear_allowed"], True, r)

    # "Clear everything": the admin calls it, it needs the dev row, it empties the city and keeps the logs.
    ADMIN = "00000000-0000-0000-0000-0000000000a8"
    NOBODY = "00000000-0000-0000-0000-0000000000b8"
    ALLOW = "insert into settings (name, value) values ('clear_allowed', 'true'::jsonb) on conflict (name) do update set value = 'true'::jsonb"

    def as_user(self, uid, body):
        return f"set local role authenticated; select set_config('request.jwt.claim.sub', '{uid}', true); {body}; reset role"

    def clear(self, *before):
        return run(f"insert into admins (user_id) values ('{self.ADMIN}')", self.ALLOW, *before, self.as_user(self.ADMIN, "create temp table c as select sim_clear_all() as v"), "select v from c")

    def test_clear_empties_the_city_and_says_how_much_went(self):
        r = run(f"insert into admins (user_id) values ('{self.ADMIN}')", self.ALLOW, "select sim_seed('{}'::jsonb)", self.as_user(self.ADMIN, "create temp table c as select sim_clear_all() as v"),
                "select v, (select count(*) from kitchens) k, (select count(*) from riders) r, (select count(*) from menu_items) d, (select count(*) from orders) o, (select count(*) from kitchen_staff) s from c")
        x = r[-1]
        self.assertTrue(x["v"]["ok"], x)
        self.assertGreaterEqual(x["v"]["kitchens"], 10); self.assertGreaterEqual(x["v"]["dishes"], 120)
        self.assertEqual((x["k"], x["r"], x["d"], x["o"], x["s"]), (0, 0, 0, 0, 0), x)

    def test_clear_keeps_every_log_row_and_detaches_it_from_the_kitchen(self):
        r = run(f"insert into admins (user_id) values ('{self.ADMIN}')", self.ALLOW, "create temp table before as select (select count(*) from decision_log) d, (select count(*) from run_log) l",
                self.as_user(self.ADMIN, "select sim_clear_all()"),
                "select (select d from before) d0, (select l from before) l0, (select count(*) from decision_log) d1, (select count(*) from run_log) l1, (select count(*) from decision_log where kitchen_id is not null) dk, (select count(*) from run_log where kitchen_id is not null) lk")
        x = r[-1]
        self.assertEqual((x["d1"], x["l1"]), (x["d0"], x["l0"]), x)
        self.assertEqual((x["dk"], x["lk"]), (0, 0), x)

    def test_a_decision_log_row_can_have_no_kitchen(self):
        r = run("insert into decision_log (session_id, order_id, kitchen_id, decision) values ('t', null, null, '{}'::jsonb)", "select count(*) c from decision_log where kitchen_id is null")
        self.assertGreaterEqual(r[-1]["c"], 1, r)

    def test_clear_keeps_the_accounts_the_photos_and_the_pin_points(self):
        r = run(f"insert into admins (user_id) values ('{self.ADMIN}')", self.ALLOW, "create temp table b as select (select count(*) from dish_photos) p, (select count(*) from pin_points) n, (select count(*) from profiles) a",
                self.as_user(self.ADMIN, "select sim_clear_all()"),
                "select (select p from b) p0, (select n from b) n0, (select a from b) a0, (select count(*) from dish_photos) p1, (select count(*) from pin_points) n1, (select count(*) from profiles) a1")
        x = r[-1]
        self.assertEqual((x["p1"], x["n1"], x["a1"]), (x["p0"], x["n0"], x["a0"]), x)

    def test_seed_the_kitchens_after_a_clear_brings_the_city_back_with_photos(self):
        r = run(f"insert into admins (user_id) values ('{self.ADMIN}')", self.ALLOW, self.as_user(self.ADMIN, "select sim_clear_all()"), "select sim_seed('{\"part\":\"kitchens\"}'::jsonb)",
                "select (select count(*) from kitchens) k, (select count(*) from menu_items) d, (select count(*) from menu_items where image_url is not null) img, (select count(*) from dish_photos) p")
        x = r[-1]
        self.assertEqual((x["k"], x["d"]), (10, 120), x)
        self.assertGreater(x["p"], 0, x)
        self.assertGreater(x["img"], 0, x)

    def test_clear_refuses_without_the_dev_row_or_when_it_is_false(self):
        for setup in ("delete from settings where name = 'clear_allowed'", "insert into settings (name, value) values ('clear_allowed', 'false'::jsonb) on conflict (name) do update set value = 'false'::jsonb"):
            r = run(f"insert into admins (user_id) values ('{self.ADMIN}')", setup, self.as_user(self.ADMIN, "create temp table c as select sim_clear_all() as v"), "select v, (select count(*) from kitchens) k from c")
            self.assertEqual(r[-1]["v"]["error"], "clear_not_allowed", r)
            self.assertGreater(r[-1]["k"], 0, r)

    def test_someone_who_is_not_an_admin_cannot_clear_even_on_dev(self):
        self.assertIn("not_admin", str(run(self.ALLOW, self.as_user(self.NOBODY, "select sim_clear_all()"))))

    def test_the_signed_out_cannot_call_it(self):
        self.assertIn("permission denied", str(run("set local role anon", "select sim_clear_all()")))


if __name__ == "__main__":
    unittest.main()
