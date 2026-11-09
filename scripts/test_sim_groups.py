# Story #848 (epic E32): the Simulator seeds the kitchens and the riders as two groups, and "Clear everything" empties the dev city.
# Every check ends in ROLLBACK (dev stays clean). The migration is run inside each transaction first, so this passes before and after it is applied.
# SKIP_MIG=1 runs against the database as it is (the red run before the migration).
# Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_sim_groups.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

_MIGS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "supabase", "migrations")
MIG = "" if os.environ.get("SKIP_MIG") else "; ".join(open(os.path.join(_MIGS, f)).read() for f in ("20261104120000_sim_groups.sql", "20261104140000_sim_clear_in_slices.sql"))


def run(*stmts):
    return sql("begin; " + MIG + "; " + "; ".join(stmts) + "; rollback;")


def clear_loop(limit=500):
    """SQL for the signed-in admin: call sim_clear_all(limit) until it says done; every answer goes to the temp table c(n, v)."""
    return ("create temp table c (n serial, v jsonb); do $$ declare r jsonb; begin loop r := sim_clear_all(%d); insert into c (v) values (r); exit when coalesce((r->>'done')::boolean, true); end loop; end $$" % limit)


TOTALS = ("select (select count(*) from c) calls, coalesce((select sum((v->>'kitchens')::int) from c), 0) k, coalesce((select sum((v->>'riders')::int) from c), 0) r, "
          "coalesce((select sum((v->>'dishes')::int) from c), 0) d, coalesce((select sum((v->>'orders')::int) from c), 0) o, coalesce((select sum((v->>'logs_detached')::int) from c), 0) l")


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

    # "Clear everything": the admin calls it, it needs the dev row, it empties the city in slices and keeps the logs.
    ADMIN = "00000000-0000-0000-0000-0000000000a8"
    NOBODY = "00000000-0000-0000-0000-0000000000b8"
    ALLOW = "insert into settings (name, value) values ('clear_allowed', 'true'::jsonb) on conflict (name) do update set value = 'true'::jsonb"
    ADD_ADMIN = f"insert into admins (user_id) values ('{ADMIN}')"
    BILL = '{"item_total_paise": 28000, "to_pay_paise": 30000}'

    def as_user(self, uid, body):
        return f"set local role authenticated; select set_config('request.jwt.claim.sub', '{uid}', true); {body}; reset role"

    def cleared(self, *before, limit=500, after=()):
        """Seed or arrange (as the owner of the database), then clear in slices as the admin, then read the totals and anything in `after`."""
        return run(self.ADD_ADMIN, self.ALLOW, *before, self.as_user(self.ADMIN, clear_loop(limit)), *after, TOTALS)[-1]

    def test_clear_empties_the_city_in_slices_and_says_how_much_went(self):
        x = self.cleared("select sim_seed('{}'::jsonb)", after=("create temp table left_over as select (select count(*) from kitchens) k, (select count(*) from riders) r, (select count(*) from menu_items) d, (select count(*) from orders) o, (select count(*) from kitchen_staff) s",))
        self.assertGreaterEqual(x["k"], 10); self.assertGreaterEqual(x["d"], 120)
        self.assertGreater(x["calls"], 1, x)   # one slice per call, so a city with logs and orders takes several calls
        r = run(self.ADD_ADMIN, self.ALLOW, "select sim_seed('{}'::jsonb)", self.as_user(self.ADMIN, clear_loop()),
                "select (select count(*) from kitchens) k, (select count(*) from riders) r, (select count(*) from menu_items) d, (select count(*) from orders) o, (select count(*) from kitchen_staff) s")
        self.assertEqual(r[-1], {"k": 0, "r": 0, "d": 0, "o": 0, "s": 0}, r)

    def test_the_last_call_is_the_one_that_says_done_and_none_before_it_does(self):
        r = run(self.ADD_ADMIN, self.ALLOW, "select sim_seed('{}'::jsonb)", self.as_user(self.ADMIN, clear_loop(50)),
                "select (select count(*) from c where (v->>'done')::boolean) done_calls, (select (v->>'done')::boolean from c order by n desc limit 1) last_done")
        self.assertEqual((r[-1]["done_calls"], r[-1]["last_done"]), (1, True), r)

    def test_a_city_with_more_orders_than_one_slice_needs_several_calls_and_ends_done(self):
        kitchen = "00000000-0000-0000-0000-0000000000e9"
        orders = (f"insert into kitchens (id, session_id, name, pin_codes, synthetic) values ('{kitchen}', 's', 'Slice Test', array['110001'], true)",
                  "insert into orders (id, kitchen_id, session_id, client_order_key, items, total_paise, address, bill, status) "
                  f"select md5('slice-' || i)::uuid, '{kitchen}', 's', 'slice-' || i, '[]'::jsonb, 30000, 'a', '{self.BILL}'::jsonb, 'delivered' from generate_series(1, 1200) i")
        x = self.cleared(*orders, limit=500)
        self.assertGreaterEqual(x["o"], 1200, x)
        self.assertGreaterEqual(x["calls"], 4, x)   # 1200 orders in slices of 500 is three order calls, plus the log call and the final call
        r = run(self.ADD_ADMIN, self.ALLOW, *orders, self.as_user(self.ADMIN, clear_loop(500)), "select (select count(*) from orders) o, (select count(*) from kitchens) k, (select (v->>'done')::boolean from c order by n desc limit 1) done")
        self.assertEqual((r[-1]["o"], r[-1]["k"], r[-1]["done"]), (0, 0, True), r)

    def test_every_call_does_at_most_one_slice_of_the_limit(self):
        r = run(self.ADD_ADMIN, self.ALLOW, "select sim_seed('{}'::jsonb)", self.as_user(self.ADMIN, clear_loop(20)),
                "select max(coalesce((v->>'orders')::int, 0)) o, max(coalesce((v->>'logs_detached')::int, 0)) l from c")
        self.assertLessEqual(r[-1]["o"], 20, r); self.assertLessEqual(r[-1]["l"], 20, r)

    def test_clear_keeps_every_log_row_and_detaches_it_from_the_kitchen(self):
        r = run(self.ADD_ADMIN, self.ALLOW, "create temp table before as select (select count(*) from decision_log) d, (select count(*) from run_log) l, (select count(*) from feedback) f, (select count(*) from params) p",
                self.as_user(self.ADMIN, clear_loop(100)),
                "select (select d from before) d0, (select l from before) l0, (select f from before) f0, (select p from before) p0, (select count(*) from decision_log) d1, (select count(*) from run_log) l1, (select count(*) from feedback) f1, (select count(*) from params) p1, "
                "(select count(*) from decision_log where kitchen_id is not null or order_id is not null) dk, (select count(*) from run_log where kitchen_id is not null) lk, (select count(*) from feedback where kitchen_id is not null or order_id is not null) fk")
        x = r[-1]
        self.assertEqual((x["d1"], x["l1"], x["f1"], x["p1"]), (x["d0"], x["l0"], x["f0"], x["p0"]), x)
        self.assertEqual((x["dk"], x["lk"], x["fk"]), (0, 0, 0), x)

    def test_a_decision_log_row_can_have_no_kitchen(self):
        r = run("insert into decision_log (session_id, order_id, kitchen_id, decision) values ('t', null, null, '{}'::jsonb)", "select count(*) c from decision_log where kitchen_id is null")
        self.assertGreaterEqual(r[-1]["c"], 1, r)

    def test_clear_keeps_the_accounts_the_photos_and_the_pin_points(self):
        r = run(self.ADD_ADMIN, self.ALLOW, "create temp table b as select (select count(*) from dish_photos) p, (select count(*) from pin_points) n, (select count(*) from profiles) a",
                self.as_user(self.ADMIN, clear_loop()),
                "select (select p from b) p0, (select n from b) n0, (select a from b) a0, (select count(*) from dish_photos) p1, (select count(*) from pin_points) n1, (select count(*) from profiles) a1")
        x = r[-1]
        self.assertEqual((x["p1"], x["n1"], x["a1"]), (x["p0"], x["n0"], x["a0"]), x)

    def test_seed_the_kitchens_after_a_clear_brings_the_city_back_with_photos(self):
        r = run(self.ADD_ADMIN, self.ALLOW, self.as_user(self.ADMIN, clear_loop()), "select sim_seed('{\"part\":\"kitchens\"}'::jsonb)",
                "select (select count(*) from kitchens) k, (select count(*) from menu_items) d, (select count(*) from menu_items where image_url is not null) img, (select count(*) from dish_photos) p")
        x = r[-1]
        self.assertEqual((x["k"], x["d"]), (10, 120), x)
        self.assertGreater(x["p"], 0, x)
        self.assertGreater(x["img"], 0, x)

    def test_clear_refuses_without_the_dev_row_or_when_it_is_false(self):
        for setup in ("delete from settings where name = 'clear_allowed'", "insert into settings (name, value) values ('clear_allowed', 'false'::jsonb) on conflict (name) do update set value = 'false'::jsonb"):
            r = run(self.ADD_ADMIN, setup, self.as_user(self.ADMIN, "create temp table c as select sim_clear_all() as v"), "select v, (select count(*) from kitchens) k from c")
            self.assertEqual(r[-1]["v"]["error"], "clear_not_allowed", r)
            self.assertGreater(r[-1]["k"], 0, r)

    def test_someone_who_is_not_an_admin_cannot_clear_even_on_dev(self):
        self.assertIn("not_admin", str(run(self.ALLOW, self.as_user(self.NOBODY, "select sim_clear_all()"))))

    def test_the_signed_out_cannot_call_it(self):
        self.assertIn("permission denied", str(run("set local role anon", "select sim_clear_all()")))

    def test_a_call_with_no_argument_finds_one_function_not_two(self):
        r = run("select count(*) c from pg_proc where proname = 'sim_clear_all'")
        self.assertEqual(r[-1]["c"], 1, r)

    # A table that points at a kitchen, an order, a rider or a dish and has no delete rule would stop Clear. This walks the live foreign keys, so a new table turns it red here
    # (needs the token, so it runs where the database tests run, not in the token-free CI job).
    HANDLED = {"orders", "order_events", "menu_items", "kitchen_staff", "decision_log", "run_log", "feedback", "params"}

    def test_every_foreign_key_to_kitchens_orders_riders_or_dishes_cascades_sets_null_or_is_cleared_by_name(self):
        r = sql("""select c.conrelid::regclass::text child, c.confrelid::regclass::text parent, c.confdeltype d from pg_constraint c
                   where c.contype = 'f' and c.confrelid::regclass::text in ('kitchens', 'orders', 'riders', 'menu_items')""")
        stuck = [(x["child"], x["parent"]) for x in r if x["d"] not in ("c", "n") and x["child"] not in self.HANDLED]
        self.assertEqual(stuck, [], f"these tables point at a kitchen, order, rider or dish with no delete rule; teach sim_clear_all about them: {stuck}")

    def test_the_foreign_key_columns_the_slices_walk_have_an_index(self):
        want = [("decision_log", "kitchen_id"), ("decision_log", "order_id"), ("feedback", "kitchen_id"), ("params", "kitchen_id"), ("run_log", "kitchen_id"), ("order_events", "order_id"),
                ("order_events", "kitchen_id"), ("orders", "kitchen_id"), ("orders", "rider_id"), ("open_alerts", "kitchen_id"), ("push_outbox", "kitchen_id"), ("push_outbox", "order_id")]
        r = run(*[f"create temp table w{i} as select exists (select 1 from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0] where i.indrelid = '{t}'::regclass and a.attname = '{c}') ok" for i, (t, c) in enumerate(want)],
                "select " + ", ".join(f"(select ok from w{i}) w{i}" for i in range(len(want))))
        self.assertEqual([k for k, v in r[-1].items() if not v], [], r)


if __name__ == "__main__":
    unittest.main()
