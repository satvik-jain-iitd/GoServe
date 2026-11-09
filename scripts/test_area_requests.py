# Story #1049 part 3 (board NK-A): "Tell me when you come here". One row per person and pin, with the place and the phone; a bad pin is refused; nobody reads the table but the owner.
# Every check ends in ROLLBACK. Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it. Red run: SKIP_MIG=1.
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql, migration_inside

MIG = migration_inside(["20261108230000_area_requests.sql"], "to_regproc('public.area_request_add_v2') is not null")
UID = "00000000-0000-0000-0000-0000000000a9"
OTHER = "00000000-0000-0000-0000-0000000000aa"


def run(*stmts):
    r = sql("begin; " + "; ".join(([MIG] if MIG else []) + list(stmts)) + "; rollback;")
    assert isinstance(r, list), r
    return r[-1]


def as_user(body, uid=UID):
    return f"set local role authenticated; select set_config('request.jwt.claim.sub', '{uid}', true); {body}; reset role"


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class AreaRequests(unittest.TestCase):
    def test_a_request_stores_the_pin_the_place_and_the_phone(self):
        r = run("insert into customers (user_id, phone) values ('" + UID + "', '9876543210')", as_user("select area_request_add_v2('201301', 28.5355, 77.391)"),
                "select pin, lat, lng, phone from area_requests where user_id = '" + UID + "'")
        self.assertEqual((r["pin"], r["lat"], r["lng"], r["phone"]), ("201301", 28.5355, 77.391, "9876543210"), r)

    def test_asking_twice_for_the_same_pin_keeps_one_row_and_a_second_pin_is_a_second_row(self):
        r = run(as_user("select area_request_add_v2('201301')"), as_user("select area_request_add_v2('201301')"), as_user("select area_request_add_v2('201302')"),
                "select count(*)::int as n, count(distinct pin)::int as pins from area_requests where user_id = '" + UID + "'")
        self.assertEqual((r["n"], r["pins"]), (2, 2), r)

    def test_two_people_each_keep_their_own_row(self):
        r = run(as_user("select area_request_add_v2('201301')"), as_user("select area_request_add_v2('201301')", OTHER), "select count(*)::int as n from area_requests where pin = '201301'")
        self.assertEqual(r["n"], 2, r)

    def test_a_bad_pin_or_place_is_refused_in_words_and_stores_nothing(self):
        r = run(as_user("create temp table a as select area_request_add_v2('12') as p, area_request_add_v2('201301', 200, 10) as q"), "select (select p from a) as p, (select q from a) as q, (select count(*) from area_requests where user_id = '" + UID + "')::int as n")
        self.assertEqual((r["p"]["error"], r["q"]["error"], r["n"]), ("invalid_pin", "invalid_place", 0), r)

    def test_a_customer_cannot_read_the_table(self):
        r = run("select has_table_privilege('authenticated', 'area_requests', 'select')::boolean as sel, has_table_privilege('anon', 'area_requests', 'select')::boolean as anon_sel")
        self.assertEqual((r["sel"], r["anon_sel"]), (False, False), r)

    def test_nobody_signed_out_can_ask(self):
        r = sql("begin; " + MIG + "; set local role anon; select area_request_add_v2('201301'); rollback;")
        self.assertIn("permission denied", str(r), r)


if __name__ == "__main__":
    unittest.main()
