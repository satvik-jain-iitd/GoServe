# Story #935 (epic #851): an order can carry one optional note for the kitchen, up to 200 characters, and the database enforces the rule.
# Every check ends in ROLLBACK (dev stays clean). The migration runs inside each transaction first; SKIP_MIG=1 runs against the database as it is (the red run).
# Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_order_instructions.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql, migration_inside

_MIGS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "supabase", "migrations")
MIG = migration_inside(["20261107130000_order_instructions.sql"], "exists (select 1 from pg_proc where proname = 'place_order_v2' and pronargs >= 10)")   # story #1145: a later migration gave the function one more argument, so the old one must not be created again beside it
K = "00000000-0000-0000-0000-0000000009a1"
D = "00000000-0000-0000-0000-0000000009a2"
SETUP = [
    f"insert into kitchens (id, name, open, active, opens_at, closes_at, pin_codes) values ('{K}', 'Note Kitchen', true, true, '00:00', '23:59:59', '{{110016}}')",
    f"insert into menu_items (id, kitchen_id, name, price_paise, available) values ('{D}', '{K}', 'Dal', 10000, true)",
]


def run(*stmts):
    return sql("begin; " + MIG + "; " + "; ".join(SETUP + list(stmts)) + "; rollback;")


def place(note_sql, key="n1"):
    bill = "'{\"to_pay_paise\": 10000}'::jsonb"
    return (f"select place_order_v2('s1', '{key}', '{K}', '[{{\"menu_item_id\": \"{D}\", \"qty\": 1}}]'::jsonb, 'Flat 4', 10000, {bill}, null, null, {note_sql}) r")


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class Instructions(unittest.TestCase):
    def test_s1_a_note_is_saved_on_the_order_trimmed(self):
        r = run(place("'  No onion, allergy to peanuts  '"), "select instructions from orders where client_order_key = 'n1'")
        self.assertIsInstance(r, list, r)
        self.assertEqual(r[0]["instructions"], "No onion, allergy to peanuts")

    def test_s2_a_blank_or_missing_note_is_null(self):
        for note in ("null", "'   '"):
            with self.subTest(note=note):
                r = run(place(note), "select instructions from orders where client_order_key = 'n1'")
                self.assertIsInstance(r, list, r)
                self.assertIsNone(r[0]["instructions"])

    def test_s3_201_characters_is_refused_with_a_true_line_and_no_order(self):
        r = run(place("repeat('x', 201)"))
        self.assertIsInstance(r, list, r)
        self.assertEqual(r[0]["r"]["error"], "instructions_too_long")
        self.assertIn("200", r[0]["r"]["message"])
        r = run(place("repeat('x', 201)"), "select count(*) c from orders where client_order_key = 'n1'")
        self.assertEqual(r[0]["c"], 0)

    def test_s4_200_characters_is_fine(self):
        r = run(place("repeat('x', 200)"), "select length(instructions) n from orders where client_order_key = 'n1'")
        self.assertIsInstance(r, list, r)
        self.assertEqual(r[0]["n"], 200)

    def test_s5_the_table_itself_refuses_a_201_character_note(self):
        r = run(f"insert into orders (kitchen_id, session_id, client_order_key, items, total_paise, address, instructions) values ('{K}', 's2', 'n2', '[]', 100, 'x', repeat('y', 201))")
        self.assertIsInstance(r, dict, r)   # a check constraint error

    def test_s6_the_old_nine_argument_form_is_gone(self):
        r = run("select count(*) c from pg_proc where proname = 'place_order_v2'")
        self.assertEqual(r[0]["c"], 1)


if __name__ == "__main__":
    unittest.main()
