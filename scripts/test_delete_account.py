# Story #771 (E22 #249): a customer can delete the account from the You screen. The RPC `delete_my_account()` deletes the caller's own data and then the login.
# Scenario: Given a signed-in customer, when delete_my_account() runs, then their orders, events, profile, saved places, push rows, feedback and auth user are gone, and nobody else's rows are touched.
# A customer with an order still on its way is refused; a kitchen, rider or admin is not a customer and is refused; a caller with no login cannot run it.
# Every check ends in ROLLBACK (dev stays clean). Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_delete_account.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql
from test_payments import K, O, CUST, KITCHEN, OTHER, run, who, q

O3 = "00000000-0000-0000-0000-0000000000f3"
PERSONAL = [
    f"update orders set status = 'cancelled' where id = '{O}'",
    f"insert into customers (user_id, name, phone, address, pin_code) values ('{CUST}', 'Asha', '9876543210', 'Flat 4', '110016'), ('{OTHER}', 'Ravi', '9876500000', 'Flat 9', '110016')",
    f"insert into push_subscriptions (session_id, endpoint, p256dh, auth) values ('{CUST}', 'https://push.test/a', 'k', 'a'), ('{OTHER}', 'https://push.test/b', 'k', 'a')",
    f"insert into feedback (session_id, role, screen, doing, text) values ('{CUST}', 'customer', 'You', 'other', 'hello'), ('{OTHER}', 'customer', 'You', 'other', 'hi')",
    f"insert into orders (id, kitchen_id, session_id, client_order_key, items, total_paise, address, status) values ('{O3}', '{K}', '{OTHER}', 'k3', '[]', 100, 'Flat 9', 'placed')",
]
COUNT = lambda t, col, who_: f"(select count(*) from {t} where {col} = '{who_}') as {t}_{who_[-1]}"
MINE = ", ".join([COUNT("orders", "session_id", CUST), COUNT("order_events", "session_id", CUST), COUNT("customers", "user_id", CUST), COUNT("push_subscriptions", "session_id", CUST),
                  COUNT("feedback", "session_id", CUST), COUNT("auth.users", "id", CUST).replace("auth.users_", "users_")])
THEIRS = ", ".join([COUNT("orders", "session_id", OTHER), COUNT("customers", "user_id", OTHER), COUNT("push_subscriptions", "session_id", OTHER), COUNT("feedback", "session_id", OTHER),
                    COUNT("auth.users", "id", OTHER).replace("auth.users_", "users_")])
delete = lambda uid: who(uid) + [q("delete_my_account()"), "reset role"]


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class DeleteAccount(unittest.TestCase):
    def test_a_customer_with_data_loses_all_of_it_and_the_login_and_nobody_else_does(self):
        r = run(PERSONAL, delete(CUST), final=MINE + ", " + THEIRS)
        self.assertEqual(r["rs"][0]["ok"], True, r)
        self.assertEqual([r[k] for k in ("orders_1", "order_events_1", "customers_1", "push_subscriptions_1", "feedback_1", "users_1")], [0] * 6, r)
        self.assertEqual([r[k] for k in ("orders_3", "customers_3", "push_subscriptions_3", "feedback_3", "users_3")], [1, 1, 1, 1, 1], r)

    def test_a_guest_with_no_profile_rows_can_delete_too(self):
        r = run(delete(OTHER), final=COUNT("auth.users", "id", OTHER).replace("auth.users_", "users_"))
        self.assertEqual((r["rs"][0]["ok"], r["users_3"]), (True, 0), r)

    def test_an_order_still_on_its_way_stops_the_delete_and_nothing_is_removed(self):
        r = run(delete(CUST), final=MINE)
        self.assertEqual((r["rs"][0]["ok"], r["rs"][0]["error"]), (False, "order_active"), r)
        self.assertEqual((r["orders_1"], r["users_1"]), (1, 1), r)

    def test_a_kitchen_user_is_not_a_customer_and_is_refused(self):
        r = run(delete(KITCHEN), final=COUNT("auth.users", "id", KITCHEN).replace("auth.users_", "users_"))
        self.assertEqual((r["rs"][0]["ok"], r["rs"][0]["error"], r["users_2"]), (False, "not_a_customer", 1), r)

    def test_a_caller_with_no_login_cannot_run_it(self):
        r = sql("begin; set local role anon; select delete_my_account(); rollback;")
        self.assertIn("permission denied", str(r), r)


if __name__ == "__main__":
    unittest.main()
