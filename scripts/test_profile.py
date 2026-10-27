# Story #340 (E27, plan v2 B.4): a customer keeps a name and email, and can delete the account.
# Scenario: Given a signed-in customer, when they delete the account, then their data is soft-deleted and purged by a job.
# Soft delete at once (the profile is hidden, pings stop); the purge job, later, removes the personal rows, blanks the name and phone on their orders and deletes the login.
# Every check ends in ROLLBACK (dev stays clean). Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_profile.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql
from test_payments import O, CUST, OTHER, SETUP, q, run

PERSONAL = [
    f"insert into customers (user_id, name, phone, address, pin_code) values ('{CUST}', 'Asha', '9876543210', 'Flat 4', '110016')",
    f"insert into addresses (user_id, label, house, building, pin_code, lat, lng) values ('{CUST}', 'Home', '4', 'Green Park', '110016', 28.5, 77.2)",
    f"insert into push_devices (session_id, platform, token) values ('{CUST}', 'android', 'tok-a')",
    f"update orders set customer_name = 'Asha', customer_phone = '9876543210' where id = '{O}'",
]
GONE = lambda t, col="user_id": f"(select count(*) from {t} where {col} = '{CUST}') as {t}"


def get(user=CUST):
    return q(f"profile_get_v2('{user}')")


def put(name="Asha K", email="asha@example.com", user=CUST):
    n = "null" if name is None else f"'{name}'"
    e = "null" if email is None else f"'{email}'"
    return q(f"profile_set_v2('{user}', {n}, {e})")


def delete(user=CUST):
    return q(f"account_delete_v2('{user}')")


def purge(days=30):
    return q(f"purge_deleted_accounts_v2({days})")


AGE = f"update profiles set deleted_at = now() - interval '31 days' where user_id = '{CUST}'"


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class Profile(unittest.TestCase):
    def test_a_new_customer_has_an_empty_profile_and_can_set_a_name_and_email(self):
        r = run(get(), put(), get())
        self.assertEqual(r["rs"][0], {"ok": True, "profile": {"name": None, "email": None}}, r)
        self.assertEqual(r["rs"][1], {"ok": True}, r)
        self.assertEqual(r["rs"][2]["profile"], {"name": "Asha K", "email": "asha@example.com"}, r)

    def test_only_the_fields_sent_change_and_an_empty_one_is_cleared(self):
        r = run(put("Asha", "a@example.com"), q(f"profile_set_v2('{CUST}', 'Asha B', null)"), get(), put(None, ""), get())
        self.assertEqual(r["rs"][2]["profile"], {"name": "Asha B", "email": "a@example.com"}, r)   # a null name or email is "not sent"
        self.assertEqual(r["rs"][4]["profile"]["email"], None, r)                                      # an empty string clears

    def test_a_bad_name_or_email_is_refused(self):
        r = run(put("x" * 81), put("A", "not-an-email"), put("A", "a@b"), put("   ", None), get())
        self.assertEqual([x["error"] for x in r["rs"][:4]], ["invalid_name", "invalid_email", "invalid_email", "invalid_name"], r)
        self.assertEqual(r["rs"][4]["profile"], {"name": None, "email": None}, r)

    def test_deleting_the_account_hides_the_profile_stops_the_pings_and_keeps_the_rest_for_the_job(self):
        r = run(PERSONAL, put(), delete(), get(), put(), final=GONE("customers") + ", " + GONE("addresses") + ", " + GONE("push_devices", "session_id") + f", (select count(*) from profiles where user_id = '{CUST}' and deleted_at is not null and name is null and email is null) as soft")
        self.assertEqual(r["rs"][2], {"ok": True}, r)
        self.assertEqual((r["rs"][3]["error"], r["rs"][4]["error"]), ("account_deleted", "account_deleted"), r)
        self.assertEqual((r["soft"], r["push_devices"], r["customers"], r["addresses"]), (1, 0, 1, 1), r)   # soft: hidden, no pings; the personal rows wait for the purge

    def test_deleting_twice_is_the_same_answer(self):
        r = run(delete(), delete())
        self.assertEqual((r["rs"][0], r["rs"][1]), ({"ok": True}, {"ok": True}), r)

    def test_the_purge_removes_personal_rows_blanks_the_orders_and_deletes_the_login_only_after_the_wait(self):
        r = run(PERSONAL, put(), delete(), purge(30), AGE, purge(30), final=GONE("customers") + ", " + GONE("addresses") + ", " + GONE("profiles")
                + f", (select count(*) from auth.users where id = '{CUST}') as login, (select row_to_json(o) from (select customer_name, customer_phone, address, status from orders where id = '{O}') o) as ord, (select count(*) from orders where id = '{O}') as orders")
        self.assertEqual((r["rs"][3]["purged"], r["rs"][5]["purged"]), (0, 1), r)   # too young the first time
        self.assertEqual((r["customers"], r["addresses"], r["profiles"], r["login"]), (0, 0, 0, 0), r)
        self.assertEqual(r["orders"], 1, r)   # the order stays for the books
        self.assertEqual(r["ord"], {"customer_name": None, "customer_phone": None, "address": "[deleted]", "status": "placed"}, r)

    def test_another_customers_data_is_not_touched(self):
        r = run(f"insert into customers (user_id, name) values ('{OTHER}', 'Other')", PERSONAL, delete(), AGE, purge(30), final=f"(select count(*) from customers where user_id = '{OTHER}') as other, (select count(*) from auth.users where id = '{OTHER}') as login")
        self.assertEqual((r["other"], r["login"]), (1, 1), r)

    def test_nobody_reads_the_table_and_only_the_service_role_calls_the_functions(self):
        for role in ("anon", "authenticated"):
            for stmt in ("select count(*) from profiles", f"select profile_get_v2('{CUST}')", f"select account_delete_v2('{CUST}')", "select purge_deleted_accounts_v2(30)"):
                r = sql("begin; " + "; ".join(SETUP + [f"set local role {role}", stmt]) + "; rollback;")
                self.assertIn("permission denied", str(r), (role, stmt))


if __name__ == "__main__":
    unittest.main()
