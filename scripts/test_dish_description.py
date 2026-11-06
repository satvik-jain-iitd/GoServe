# Story #779 (epic E32): one short line under each dish. menu_items.description is text, at most 60 characters, nullable. Every check ends in ROLLBACK.
# SKIP_MIG=1 runs against the database as it is (the red run before the migration).
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_dish_description.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

HERE = os.path.dirname(os.path.abspath(__file__))
MIG = "" if os.environ.get("SKIP_MIG") else open(os.path.join(HERE, "..", "supabase", "migrations", "20261106100000_dish_description.sql")).read()
K1 = "00000000-0000-0000-0000-0000000000e1"
KITCHEN = f"insert into kitchens (id, session_id, name, active, open, pin_codes) values ('{K1}', 's', 'Test One', true, true, array['110001'])"


def run(*stmts):
    return sql("begin; " + MIG + "; " + "; ".join(stmts) + "; rollback;")


def dish(desc):
    d = "null" if desc is None else "'" + desc + "'"
    return f"insert into menu_items (kitchen_id, name, price_paise, description) values ('{K1}', 'Dal', 22000, {d})"


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class DishDescription(unittest.TestCase):
    def test_a_dish_keeps_a_line_of_60_characters(self):
        r = run(KITCHEN, dish("x" * 60), "select char_length(description) n from menu_items where kitchen_id = '%s'" % K1)
        self.assertIn("60", str(r))

    def test_a_line_of_61_characters_is_refused(self):
        self.assertIn("menu_items_description_len", str(run(KITCHEN, dish("x" * 61))))

    def test_no_line_is_allowed(self):
        r = run(KITCHEN, dish(None), "select description is null as empty from menu_items where kitchen_id = '%s'" % K1)
        self.assertNotIn("error", str(r))
        self.assertIn("'empty': True", str(r))


if __name__ == "__main__":
    unittest.main()
