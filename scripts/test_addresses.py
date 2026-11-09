# Story #976: saved addresses. A customer reads and writes only their own rows; a row has a label, words, a six-digit pin; at most 20 each; address_near_m answers 200 unless the admin changed it.
# Every check ends in ROLLBACK (dev stays clean). The migration runs inside each transaction first; SKIP_MIG=1 runs against the database as it is (the red run before the migration).
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_addresses.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

HERE = os.path.dirname(os.path.abspath(__file__))
MIG = "" if os.environ.get("SKIP_MIG") else open(os.path.join(HERE, "..", "supabase", "migrations", "20261108110000_addresses.sql")).read()
A, B = ("00000000-0000-0000-0000-0000000000a%d" % i for i in (1, 2))


def run(*stmts):
    return sql("begin; " + MIG + "; " + "; ".join(stmts) + "; rollback;")


def user(uid):
    return f"insert into auth.users (id, email, aud, role, instance_id) values ('{uid}', '{uid}@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')"


def as_user(uid, body):
    return f"set local role authenticated; select set_config('request.jwt.claim.sub', '{uid}', true); {body}; reset role"


def add(uid, label="Home", address="C-128, Green Avenue Colony, Satai Road", pin="471001"):
    return as_user(uid, f"insert into addresses (label, address, pin_code) values ('{label}', '{address}', '{pin}')")


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class Addresses(unittest.TestCase):
    def test_s1_a_customer_adds_and_reads_their_own_address(self):
        r = run(user(A), add(A), as_user(A, "select label, pin_code from addresses"))
        self.assertEqual(r, [{"label": "Home", "pin_code": "471001"}])

    def test_s2_another_customer_sees_none_and_cannot_change_or_delete_it(self):
        r = run(user(A), user(B), add(A), as_user(B, "select count(*) as n from addresses"))
        self.assertIn("'n': 0", str(r))
        r = run(user(A), user(B), add(A), as_user(B, "update addresses set label = 'Mine'"), as_user(B, "delete from addresses"), "select count(*) as n from addresses where label = 'Home'")
        self.assertIn("'n': 1", str(r))

    def test_s3_a_customer_cannot_write_a_row_for_someone_else(self):
        r = str(run(user(A), user(B), as_user(A, f"insert into addresses (user_id, label, address, pin_code) values ('{B}', 'Home', 'C-128, Green Avenue', '471001')")))
        self.assertIn("row-level security", r)

    def test_s4_the_rules_on_label_words_and_pin(self):
        for label, address, pin in (("", "C-128, Green Avenue", "471001"), ("Home", "abc", "471001"), ("Home", "C-128, Green Avenue", "47100"), ("Home", "C-128, Green Avenue", "47100a")):
            r = str(run(user(A), add(A, label, address, pin)))
            self.assertIn("check", r, (label, address, pin))

    def test_s5_a_customer_has_at_most_20(self):
        many = [add(A, "L%d" % i, "C-128, Green Avenue %d" % i) for i in range(20)]
        r = str(run(user(A), *many, add(A, "One more", "C-128, Green Avenue 99")))
        self.assertIn("addresses_cap", r)

    def test_s6_a_signed_out_caller_reads_nothing(self):
        r = str(run(user(A), add(A), "set local role anon; select count(*) from addresses"))
        self.assertIn("permission denied", r)

    def test_s7_address_near_m_is_200_by_default_and_follows_the_setting(self):
        r = run(as_user(A, "select address_near_m() as m"))
        self.assertIn("'m': 200", str(r))
        r = run("update settings set value = '350'::jsonb where name = 'address_near_m'", user(A), as_user(A, "select address_near_m() as m"))
        self.assertIn("'m': 350", str(r))


if __name__ == "__main__":
    unittest.main()
