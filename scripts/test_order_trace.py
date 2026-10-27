# Story #484 (epic E25): one append-only log that answers "what happened to order X". Every check ends in ROLLBACK (dev stays clean).
# Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_order_trace.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

UID = "00000000-0000-0000-0000-0000000000e1"
DISH = "(select id from menu_items order by price_paise limit 1)"
PLACE = f"select place_order('{UID}', 'key1', jsonb_build_array(jsonb_build_object('menu_item_id', {DISH}, 'qty', 1)), 'Flat 4')"
ORDER = f"(select id from orders where session_id='{UID}')"
SUB = f"insert into push_subscriptions (session_id, endpoint, p256dh, auth) values ('{UID}', 'https://web.push.apple.com/abc', 'k', 'a')"
AS_USER = ["set local role authenticated", f"select set_config('request.jwt.claims', '{{\"sub\":\"{UID}\",\"role\":\"authenticated\"}}', true)"]
AS_OTHER = ["set local role authenticated", "select set_config('request.jwt.claims', '{\"sub\":\"00000000-0000-0000-0000-0000000000e2\",\"role\":\"authenticated\"}', true)"]
AS_ANON = ["set local role anon"]


def run(*stmts):
    return sql("begin; " + "; ".join(stmts) + "; rollback;")


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class OrderTrace(unittest.TestCase):
    def test_nobody_but_the_service_can_read_or_write_the_table(self):
        for who in (AS_USER, AS_ANON):
            self.assertIn("permission denied", str(run(*who, "select * from order_trace")), who)
            self.assertIn("permission denied", str(run(*who, "insert into order_trace (actor, event) values ('app', 'x')")), who)

    def test_the_app_writes_a_line_for_its_own_order_with_the_actor_app(self):
        r = run(PLACE, *AS_USER, f"select trace_app({ORDER}, 'delivered_asked', 'shown', 'after 3 min')",
                "reset role", "select actor, event, result, detail->>'text' as detail, order_id is not null as has_order from order_trace")
        self.assertEqual(r[-1], {"actor": "app", "event": "delivered_asked", "result": "shown", "detail": "after 3 min", "has_order": True}, r)

    def test_the_app_cannot_write_a_line_for_someone_elses_order(self):
        r = run(PLACE, f"select set_config('t.o', {ORDER}::text, true)", *AS_OTHER, "select trace_app(current_setting('t.o')::uuid, 'x', 'y', 'z')", "reset role", "select count(*) as n from order_trace")
        self.assertEqual(r[-1], {"n": 0}, r)

    def test_the_service_worker_line_finds_the_order_by_the_push_address(self):
        r = run(PLACE, SUB, *AS_ANON, "select trace_sw('https://web.push.apple.com/abc', 'push_received', 'ok', '')",
                "reset role", f"select actor, event, order_id = {ORDER} as same_order from order_trace")
        self.assertEqual(r[-1], {"actor": "sw", "event": "push_received", "same_order": True}, r)

    def test_an_unknown_push_address_is_logged_without_an_order_and_without_the_address(self):
        r = run(*AS_ANON, "select trace_sw('https://web.push.apple.com/secret', 'push_received', 'ok', '')",
                "reset role", "select order_id is null as no_order, detail::text not like '%secret%' as no_address from order_trace")
        self.assertEqual(r[-1], {"no_order": True, "no_address": True}, r)

    def test_long_text_is_cut_and_one_order_gets_at_most_200_lines(self):
        r = run(PLACE, *AS_USER, f"select trace_app({ORDER}, 'x', 'y', repeat('a', 1000))",
                f"do $$ begin for i in 1..250 loop perform trace_app({ORDER}, 'e', 'r', ''); end loop; end $$",
                "reset role", "select count(*) as n, max(length(detail->>'text')) as longest from order_trace")
        self.assertEqual(r[-1], {"n": 200, "longest": 300}, r)


if __name__ == "__main__":
    unittest.main()
