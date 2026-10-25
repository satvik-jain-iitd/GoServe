"""Story #292: the dish photo picker. Run: python3 scripts/test_dish_photos.py"""
import unittest
from dish_photos import credit, find, pick, query_for, row

P = lambda alt, w=1600, h=1000, name="Jane Doe", i=1: {"id": i, "alt": alt, "width": w, "height": h, "photographer": name, "url": f"https://www.pexels.com/photo/{i}/",
                                                       "src": {"large": f"https://images.pexels.com/photos/{i}/large.jpg"}}


class Query(unittest.TestCase):
    def test_quantities_and_brackets_go(self):
        self.assertEqual(query_for("Veg Steamed Momos (8)"), "veg steamed momos")
        self.assertEqual(query_for("Jalebi (250 g)"), "jalebi")
        self.assertEqual(query_for("Parantha Thali (2 paranthas, sabzi, chutney, pickle)"), "parantha thali")

    def test_a_dish_with_a_known_better_word_uses_it(self):
        self.assertEqual(query_for("Ven Pongal"), "pongal south indian breakfast")
        self.assertEqual(query_for("Sarson Ka Saag"), "sarson ka saag")


class Pick(unittest.TestCase):
    def test_the_alt_text_must_name_the_dish(self):
        got = pick([P("A man on a bike", i=1), P("Plate of chicken biryani with raita", i=2)], "chicken biryani")
        self.assertEqual(got["id"], 2)

    def test_nothing_matching_gives_none_not_a_wrong_photo(self):
        self.assertIsNone(pick([P("A man on a bike"), P("Blue sky")], "chicken biryani"))

    def test_more_matching_words_win_and_landscape_is_preferred(self):
        a = P("Biryani", i=1)
        b = P("Chicken biryani in a bowl", i=2)
        c = P("Chicken biryani in a bowl", w=900, h=1600, i=3)   # portrait
        self.assertEqual(pick([a, c, b], "chicken biryani")["id"], 2)


class Credit(unittest.TestCase):
    def test_credit_names_the_photographer_and_pexels(self):
        self.assertEqual(credit(P("x", name="Jane Doe")), "Jane Doe on Pexels")

    def test_row_keeps_the_source_for_the_research_file(self):
        r = row(3, 5, P("x", i=77), "https://store/menu/dream/3-5.jpg", "2026-10-25")
        self.assertEqual((r["kitchen_n"], r["dish_n"], r["source_page"], r["licence"]), (3, 5, "https://www.pexels.com/photo/77/", "Pexels licence"))
        self.assertEqual(r["image_credit"], "Jane Doe on Pexels")


class Find(unittest.TestCase):
    def test_find_searches_by_the_cleaned_name_and_returns_the_pick(self):
        seen = []
        def search(q):
            seen.append(q)
            return [P("Steamed momos on a plate", i=9)]
        self.assertEqual(find("Veg Steamed Momos (8)", search)["id"], 9)
        self.assertEqual(seen, ["veg steamed momos"])


if __name__ == "__main__":
    unittest.main()
