# Story #1031: local names for served pins. pincode_aliases (admin writes, service reads), search_places unions them with the GeoNames name, 50 candidates.
# Every check ends in ROLLBACK. The migration runs inside each transaction; SKIP_MIG=1 runs against the database as it is (the red run).
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_pincode_aliases.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql, migration_inside

HERE = os.path.dirname(os.path.abspath(__file__))
MIG = migration_inside(["20261108180000_place_aliases.sql"], "select to_regclass('public.pincode_aliases') is not null")   # empty once dev has it applied (the proof is the same)
ADMIN, NOBODY = "00000000-0000-0000-0000-0000000000d1", "00000000-0000-0000-0000-0000000000d2"
USERS = [f"insert into auth.users (id, email, email_confirmed_at, aud, role, instance_id) values ('{u}', '{u[-2:]}@example.com', now(), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')" for u in (ADMIN, NOBODY)] \
        + [f"insert into admins (user_id) values ('{ADMIN}')"]


def search(q):
    r = sql("begin; " + MIG + f"; select coalesce(jsonb_agg(to_jsonb(s)), '[]') as rows from search_places('{q}') s; rollback;")
    assert isinstance(r, list), r
    return r[-1]["rows"]


def as_user(uid, body):
    return f"set local role authenticated; select set_config('request.jwt.claim.sub', '{uid}', true); {body}; reset role"


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class PincodeAliases(unittest.TestCase):
    def test_s1_a_local_name_finds_its_pin(self):
        rows = search("laxmi nagar")
        self.assertTrue(any(r["pin"] == "110092" and r["place"] == "Laxmi Nagar" for r in rows), rows)
        self.assertTrue(any(r["pin"] == "471001" and r["place"] == "Green Avenue Colony" for r in search("green avenue")))

    def test_s2_the_geonames_name_and_the_aliases_both_work_with_one_row_per_name(self):
        rows = [r for r in search("shakarpur") if r["pin"] == "110092"]
        self.assertEqual([r["place"] for r in rows], ["Shakarpur"], rows)   # the alias and the post-office name are the same word: one row
        self.assertTrue(any(r["pin"] == "110092" for r in search("1100")))

    def test_s3_up_to_fifty_candidates_reach_the_function(self):
        rows = search("nagar")
        self.assertGreater(len(rows), 20, len(rows))
        self.assertLessEqual(len(rows), 50)

    def test_s4_the_seed_is_in_for_the_served_pins(self):
        r = sql("begin; " + MIG + "; select (select count(*) from pincode_aliases where pin = '110092') as a, (select count(*) from pincode_aliases where pin = '471001') as b; rollback;")[-1]
        self.assertEqual((r["a"], r["b"]), (5, 3), r)

    def test_s5_an_admin_writes_and_a_customer_neither_reads_nor_writes(self):
        ok = sql("begin; " + MIG + "; " + "; ".join(USERS) + "; " + as_user(ADMIN, "insert into pincode_aliases (pin, name) values ('110092', 'Krishna Nagar')") + "; select count(*) as n from pincode_aliases where name = 'Krishna Nagar'; rollback;")
        self.assertEqual(ok[-1], {"n": 1}, ok)
        w = sql("begin; " + MIG + "; " + "; ".join(USERS) + "; " + as_user(NOBODY, "insert into pincode_aliases (pin, name) values ('110092', 'Nope')") + "; rollback;")
        self.assertIn("row-level security", str(w), w)
        seen = sql("begin; " + MIG + "; " + "; ".join(USERS) + "; set local role authenticated; " + f"select set_config('request.jwt.claim.sub', '{NOBODY}', true); select count(*) as n from pincode_aliases; rollback;")
        self.assertEqual(seen[-1], {"n": 0}, seen)
        anon = sql("begin; " + MIG + "; set local role anon; select count(*) from pincode_aliases; rollback;")
        self.assertIn("permission denied", str(anon), anon)

    def test_s6_a_name_twice_for_one_pin_is_refused_whatever_the_case(self):
        w = sql("begin; " + MIG + "; insert into pincode_aliases (pin, name) values ('110092', 'LAXMI NAGAR'); rollback;")
        self.assertIn("duplicate key", str(w), w)


if __name__ == "__main__":
    unittest.main()
