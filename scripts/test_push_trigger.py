# Story #563 (layer 2 of #351): an order change calls /push/notify.
# Scenario: Given a customer with an Android and an iOS token, when the kitchen accepts the order, then /push/notify is called once with the order and the secret.
# The database queues one push job per order change (any path) for a customer who has a device, and asks the Edge Function through pg_net with the secret from the vault.
# The call itself is made after the commit; here every check ends in ROLLBACK and reads the request in pg_net's queue instead.
# Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_push_trigger.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql
from test_payments import O, CUST, OTHER, SETUP, q, run

JOBS = f"(select coalesce(jsonb_agg(status order by id), '[]'::jsonb) from push_jobs where order_id = '{O}') as jobs"
DEV = [f"insert into push_devices (session_id, platform, token) values ('{CUST}', 'android', 'tok-a'), ('{CUST}', 'ios', 'tok-i')"]
VAULT = ["select vault.create_secret('https://example.test/functions/v1/push/notify', 'push_notify_url')", "select vault.create_secret('s3cret', 'push_notify_secret')"]
QUEUE = "(select coalesce(jsonb_agg(jsonb_build_object('url', url, 'secret', headers ->> 'x-push-secret', 'body', convert_from(body, 'utf8')::jsonb)), '[]'::jsonb) from net.http_request_queue) as sent"


def status(to):
    return f"update orders set status = '{to}' where id = '{O}'"


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class PushTrigger(unittest.TestCase):
    def test_each_status_change_of_a_customer_with_a_device_queues_one_job(self):
        r = run(DEV, status("accepted"), status("preparing"), status("ready"), final=JOBS)
        self.assertEqual(r["jobs"], ["accepted", "preparing", "ready"], r)

    def test_the_same_status_again_and_a_customer_without_a_device_queue_nothing(self):
        r = run(DEV, status("accepted"), status("accepted"), final=JOBS)
        self.assertEqual(r["jobs"], ["accepted"], r)
        r = run(status("accepted"), status("cancelled"), final=JOBS)
        self.assertEqual(r["jobs"], [], r)

    def test_a_new_order_with_a_device_queues_its_placed_push(self):
        r = run(DEV, f"insert into orders (id, kitchen_id, session_id, client_order_key, items, total_paise, address) values ('{O[:-1]}9', '00000000-0000-0000-0000-0000000000b1', '{CUST}', 'k9', '[]', 100, 'x')",
                final=f"(select coalesce(jsonb_agg(status), '[]'::jsonb) from push_jobs where order_id = '{O[:-1]}9') as jobs")
        self.assertEqual(r["jobs"], ["placed"], r)

    def test_the_job_asks_the_edge_function_once_with_the_secret_and_the_order(self):
        r = run(DEV, VAULT, status("accepted"), final=QUEUE)
        self.assertEqual(len(r["sent"]), 1, r)
        self.assertEqual((r["sent"][0]["url"], r["sent"][0]["secret"], r["sent"][0]["body"]), ("https://example.test/functions/v1/push/notify", "s3cret", {"order_id": O}), r)

    def test_with_no_secret_in_the_vault_the_status_still_changes_and_nothing_is_asked(self):
        r = run(DEV, status("accepted"), final=QUEUE + f", (select status from orders where id = '{O}') as st, (select count(*) from push_jobs) as n")
        self.assertEqual((r["st"], r["n"], r["sent"]), ("accepted", 1, []), r)   # the job is kept so a later sweep can ask

    def test_nobody_reads_or_calls_the_job_table_and_functions_by_hand(self):
        for role in ("anon", "authenticated"):
            for stmt in ("select count(*) from push_jobs", "select push_job_send(1)"):
                r = sql("begin; " + "; ".join(SETUP + [f"set local role {role}", stmt]) + "; rollback;")
                self.assertIn("permission denied", str(r), (role, stmt))


if __name__ == "__main__":
    unittest.main()
