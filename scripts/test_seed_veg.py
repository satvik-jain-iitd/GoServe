# Story (data fix, finding F300): the first seed kitchen listed Butter Chicken and Chicken Biryani without a veg flag, so they took the column default (veg = true)
# and the menu showed a veg mark on chicken. Migration 0051 sets them to non-veg. The check reads the database, so it needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env).
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_seed_veg.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

SEED = "11111111-1111-1111-1111-111111111111"


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class SeedVeg(unittest.TestCase):
    def veg_of(self):
        r = sql(f"select name, veg from menu_items where kitchen_id = '{SEED}'")
        self.assertIsInstance(r, list, r)
        return {x["name"]: x["veg"] for x in r}

    def test_the_two_chicken_dishes_are_not_veg(self):
        v = self.veg_of()
        self.assertFalse(v["Butter Chicken"])
        self.assertFalse(v["Chicken Biryani"])

    def test_the_veg_dishes_stay_veg(self):
        v = self.veg_of()
        for d in ("Aloo Paratha", "Paneer Tikka", "Dal Makhani", "Chole Bhature", "Pani Puri", "Samosa (2 pieces)", "Gulab Jamun (2 pieces)"):
            self.assertTrue(v[d], d)

    def test_no_dish_name_with_chicken_or_mutton_is_veg_anywhere(self):
        r = sql("select name from menu_items where veg and name ~* '(chicken|mutton|fish|keema|prawn|lamb)'")
        self.assertEqual(r, [], r)


if __name__ == "__main__":
    unittest.main()
