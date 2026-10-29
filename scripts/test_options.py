# Story #344 (E27, plan v2 B.8): add-on groups. A dish can have choices (spice level, extras) with a minimum and a maximum.
# Scenario: Given an add-on group with min 1 and max 2, when an order picks 3, then it is refused with a clear error.
# Every check ends in ROLLBACK (dev stays clean). Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_options.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

K = "'00000000-0000-0000-0000-0000000000b1'"
D = "'00000000-0000-0000-0000-0000000000b2'"
D2 = "'00000000-0000-0000-0000-0000000000b3'"
G = "'00000000-0000-0000-0000-0000000000c1'"      # Extras: min 1, max 2
G2 = "'00000000-0000-0000-0000-0000000000c2'"     # Spice: min 0, max 1
O = [f"'00000000-0000-0000-0000-0000000000e{i}'" for i in range(1, 7)]   # e1..e3 extras (e3 is sold out), e4 spice, e5 belongs to another dish, e6 extras
SETUP = [
    f"insert into kitchens (id, name, pin_codes) values ({K}, 'Test', array['110016'])",
    f"insert into menu_items (id, kitchen_id, name, price_paise) values ({D}, {K}, 'Thali', 14000), ({D2}, {K}, 'Chai', 3000)",
    f"insert into option_groups (id, menu_item_id, name, min_select, max_select, sort) values ({G}, {D}, 'Extras', 1, 2, 1), ({G2}, {D}, 'Spice', 0, 1, 2)",
    f"insert into options (id, group_id, name, price_paise, available, sort) values ({O[0]}, {G}, 'Raita', 2000, true, 1), ({O[1]}, {G}, 'Papad', 1000, true, 2), ({O[2]}, {G}, 'Pickle', 500, false, 3), ({O[3]}, {G2}, 'Hot', 0, true, 1), ({O[5]}, {G}, 'Chutney', 500, true, 4)",
]


def run(*stmts):
    return sql("begin; " + "; ".join(SETUP + list(stmts)) + "; rollback;")


def check(picked, dish=D):
    arr = "array[" + ",".join(picked) + "]::uuid[]" if picked else "array[]::uuid[]"
    r = run(f"select validate_options({dish}, {arr}) as v")
    assert isinstance(r, list), r
    return r[-1]["v"]


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class Options(unittest.TestCase):
    def test_a_pick_inside_the_limits_is_ok_and_adds_the_extra_price(self):
        self.assertEqual(check([O[0], O[1]]), {"ok": True, "extra_paise": 3000})
        self.assertEqual(check([O[0], O[3]]), {"ok": True, "extra_paise": 2000})

    def test_three_picks_in_a_group_with_max_two_is_refused_with_a_clear_error(self):
        v = check([O[0], O[1], O[5]])
        self.assertEqual((v["ok"], v["error"], v["group"], v["max"], v["picked"]), (False, "option_group_max", "Extras", 2, 3))
        self.assertEqual(v["message"], "Pick at most 2 for Extras.")

    def test_no_pick_in_a_group_with_min_one_is_refused(self):
        v = check([])
        self.assertEqual((v["ok"], v["error"], v["group"], v["min"]), (False, "option_group_min", "Extras", 1))
        self.assertEqual(v["message"], "Pick at least 1 for Extras.")

    def test_a_sold_out_option_an_option_of_another_dish_and_a_repeat_are_refused(self):
        self.assertEqual(check([O[2]])["error"], "option_unavailable")
        self.assertEqual(check([O[0], O[4]])["error"], "unknown_option")
        self.assertEqual(check([O[0], O[0]])["error"], "duplicate_option")

    def test_a_dish_with_no_groups_takes_no_options(self):
        self.assertEqual(check([], D2), {"ok": True, "extra_paise": 0})
        self.assertEqual(check([O[0]], D2)["error"], "unknown_option")

    def test_the_database_refuses_a_group_whose_max_is_below_its_min(self):
        r = run(f"insert into option_groups (menu_item_id, name, min_select, max_select) values ({D}, 'Bad', 2, 1)")
        self.assertIn("error", str(r))

    def test_a_customer_can_read_groups_and_options_but_not_change_them(self):
        r = run("set local role anon", "select (select count(*) from option_groups) as g, (select count(*) from options) as o")
        self.assertEqual(r[-1], {"g": 2, "o": 5}, r)
        self.assertIn("row-level security", str(run("set local role anon", f"insert into options (group_id, name) values ({G}, 'x')")))
        r = run("set local role anon", f"update options set price_paise = 0 where group_id = {G}", f"reset role", f"select count(*) as n from options where price_paise = 0 and group_id = {G}")
        self.assertEqual(r[-1], {"n": 0}, r)   # an update by a customer changes no row


if __name__ == "__main__":
    unittest.main()
