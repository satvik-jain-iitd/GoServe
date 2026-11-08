# Story #942: the account purge blanks EVERY personal column, and a list of personal columns keeps it honest. A new personal column on orders fails the
# schema check below until it is added to PII_ORDERS and to purge_deleted_accounts_v2. Every check ends in ROLLBACK (dev stays clean).
# The migration runs inside each transaction; SKIP_MIG=1 runs against the database as it is (the red run before the migration).
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_purge_pii.py
import os, re, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql
from test_payments import O, CUST, SETUP, q
from test_profile import AGE, delete, purge

HERE = os.path.dirname(os.path.abspath(__file__))
MIG = "" if os.environ.get("SKIP_MIG") else open(os.path.join(HERE, "..", "supabase", "migrations", "20261108150000_purge_pii.sql")).read()

# The personal columns of an order, and what the purge leaves in them. `address` is NOT NULL, so it carries a marker.
PII_ORDERS = {"customer_name": None, "customer_phone": None, "address": "[deleted]", "drop_lat": None, "drop_lng": None, "instructions": None, "pin_code": None}
# Columns of orders that look personal by name but are not: the kitchen's words, the app platform, the order's own session link (a user id, deleted with the login).
NOT_PERSONAL = {"session_id", "cancel_reason", "client_platform", "pin_code_kitchen"}
LOOKS_PERSONAL = re.compile(r"(name|phone|address|email|lat|lng|note|instruction|pin_code|photo)")
PHONE = "9876543210"
FILL = [
    f"insert into customers (user_id, name, phone, address, pin_code) values ('{CUST}', 'Asha', '{PHONE}', 'Flat 4', '110016')",
    f"insert into push_devices (session_id, platform, token) values ('{CUST}', 'android', 'tok-a')",
    f"insert into push_subscriptions (session_id, endpoint, p256dh, auth) values ('{CUST}', 'https://push.example/abc', 'k', 'a')",
    f"insert into otp_codes (phone, code_hash, expires_at) values ('{PHONE}', 'h', now() + interval '5 minutes')",
    f"update orders set customer_name = 'Asha', customer_phone = '{PHONE}', drop_lat = 28.5, drop_lng = 77.2, instructions = 'Ring twice', pin_code = '110016' where id = '{O}'",
]


def run(*steps, final=""):
    flat = [s for st in steps for s in (st if isinstance(st, list) else [st])]
    r = sql("begin; " + "; ".join(SETUP) + "; " + MIG + "; " + "; ".join(flat + ["reset role", "select (select jsonb_agg(r order by i) from res) as rs" + (", " + final if final else "")]) + "; rollback;")
    assert isinstance(r, list), r
    return r[-1]


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class PurgePii(unittest.TestCase):
    def test_s1_after_the_purge_every_personal_column_of_the_order_is_blank(self):
        cols = ", ".join(PII_ORDERS)
        r = run(FILL, delete(), AGE, purge(30), final=f"(select row_to_json(o) from (select {cols} from orders where id = '{O}') o) as ord")
        self.assertEqual(r["ord"], PII_ORDERS, r)

    def test_s2_the_push_endpoint_and_the_login_code_of_the_customer_are_gone_too(self):
        r = run(FILL, delete(), AGE, purge(30), final=f"(select count(*) from push_subscriptions where session_id = '{CUST}') as subs, (select count(*) from push_devices where session_id = '{CUST}') as devs, (select count(*) from otp_codes where phone = '{PHONE}') as otp")
        self.assertEqual((r["subs"], r["devs"], r["otp"]), (0, 0, 0), r)

    def test_s3_another_customers_login_code_stays(self):
        other = "insert into otp_codes (phone, code_hash, expires_at) values ('9000000001', 'h', now() + interval '5 minutes')"
        r = run(FILL, other, delete(), AGE, purge(30), final="(select count(*) from otp_codes where phone = '9000000001') as keep")
        self.assertEqual(r["keep"], 1, r)

    def test_s4_the_list_matches_the_schema_so_a_new_personal_column_fails_here(self):
        r = sql("select column_name from information_schema.columns where table_schema = 'public' and table_name = 'orders'")
        seen = {x["column_name"] for x in r if LOOKS_PERSONAL.search(x["column_name"])} - NOT_PERSONAL
        self.assertEqual(seen, set(PII_ORDERS), f"orders has a personal-looking column the purge does not know: {sorted(seen ^ set(PII_ORDERS))}. Add it to PII_ORDERS and to purge_deleted_accounts_v2.")


if __name__ == "__main__":
    unittest.main()
