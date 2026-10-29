# Story #558 (layer 2 of #339): the returning customer. A guest on a new phone signs in with the number of an account they already have; what they ordered
# as a guest moves to that account. claim_guest_orders_v2 is the one database function for it; the Edge Function checks both tokens first.
# Scenario: Given a returning customer on a new phone, when they sign in, then the orders of the new guest session are on their old account.
# Every check ends in ROLLBACK (dev stays clean). Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_claim_guest.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

K = "00000000-0000-0000-0000-0000000000b1"
GUEST, OLD, OTHER, GUEST2 = [f"00000000-0000-0000-0000-0000000000a{i}" for i in (1, 2, 3, 4)]
O1, O2, O3 = [f"00000000-0000-0000-0000-0000000000f{i}" for i in (1, 2, 3)]
SETUP = [
    f"insert into auth.users (id, is_anonymous) values ('{GUEST}', true), ('{GUEST2}', true), ('{OLD}', false), ('{OTHER}', false)",
    f"insert into kitchens (id, name, pin_codes) values ('{K}', 'Test', array['110016'])",
    f"insert into orders (id, kitchen_id, session_id, client_order_key, items, total_paise, address) values ('{O1}', '{K}', '{GUEST}', 'k1', '[]', 100, 'x'), ('{O2}', '{K}', '{GUEST}', 'k2', '[]', 100, 'x'), ('{O3}', '{K}', '{OTHER}', 'k3', '[]', 100, 'x')",
    f"insert into order_events (order_id, kitchen_id, session_id, event, actor) values ('{O1}', '{K}', '{GUEST}', 'order.placed', 'customer')",
    "create temp table res (i serial, r jsonb)", "grant all on res to public",
]


def claim(frm=GUEST, to=OLD):
    return f"insert into res (r) select claim_guest_orders_v2('{frm}', '{to}')"


def run(*steps, final=""):
    flat = [s for st in steps for s in (st if isinstance(st, list) else [st])]
    r = sql("begin; " + "; ".join(SETUP + flat + ["select (select jsonb_agg(r order by i) from res) as rs" + (", " + final if final else "")]) + "; rollback;")
    assert isinstance(r, list), r
    return r[-1]


MINE = f"(select count(*) from orders where session_id = '{OLD}') as old_orders, (select count(*) from orders where session_id = '{GUEST}') as guest_orders, " \
       f"(select count(*) from order_events where session_id = '{GUEST}') as kept_events, (select count(*) from order_tracking where session_id = '{OLD}') as old_tracking, " \
       f"(select count(*) from orders where session_id = '{OTHER}') as other_orders"


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class ClaimGuest(unittest.TestCase):
    def test_the_guests_orders_events_and_tracking_move_to_the_old_account_and_nothing_else_moves(self):
        r = run(claim(), final=MINE)
        self.assertEqual((r["rs"][0]["ok"], r["rs"][0]["orders"]), (True, 2), r)
        self.assertEqual((r["old_orders"], r["guest_orders"], r["kept_events"], r["old_tracking"], r["other_orders"]), (2, 0, 1, 2, 1), r)

    def test_the_old_account_reads_the_events_of_the_moved_order_and_a_stranger_does_not(self):
        who = lambda uid: ["reset role", "set local role authenticated", f"select set_config('request.jwt.claims', '{{\"sub\":\"{uid}\",\"role\":\"authenticated\"}}', true)"]
        mine = run(claim(), who(OLD), final=f"(select count(*) from order_events where order_id = '{O1}') as n")
        self.assertEqual(mine["n"], 1, mine)
        theirs = sql("begin; " + "; ".join(SETUP + [claim()] + who(OTHER) + [f"select count(*) as n from order_events where order_id = '{O1}'"]) + "; rollback;")
        self.assertEqual(theirs[-1], {"n": 0}, theirs)

    def test_running_it_again_moves_nothing_more(self):
        r = run(claim(), claim())
        self.assertEqual((r["rs"][1]["ok"], r["rs"][1]["orders"]), (True, 0), r)

    def test_only_a_guest_can_be_claimed_and_only_into_a_signed_in_account(self):
        r = run(claim(OTHER, OLD), claim(GUEST, GUEST2), claim(OLD, OLD), claim("00000000-0000-0000-0000-00000000dead", OLD), final=MINE)
        self.assertEqual([x.get("error") for x in r["rs"]], ["not_a_guest", "not_signed_in", "same_user", "not_a_guest"], r["rs"])
        self.assertEqual((r["old_orders"], r["guest_orders"], r["other_orders"]), (0, 2, 1), r)   # nothing moved

    def test_only_the_service_role_can_call_it(self):
        for role in ("anon", "authenticated"):
            r = sql("begin; " + "; ".join(SETUP + [f"set local role {role}", f"select claim_guest_orders_v2('{GUEST}', '{OLD}')"]) + "; rollback;")
            self.assertIn("permission denied", str(r), role)


if __name__ == "__main__":
    unittest.main()
