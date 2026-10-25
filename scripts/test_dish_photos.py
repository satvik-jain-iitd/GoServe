"""Story #292: the dish photo loader (Openverse). Run: python3 scripts/test_dish_photos.py"""
import io, json, unittest
from pathlib import Path
from PIL import Image
from dish_photos import CHOICES, MAX_BYTES, credit, row, webp_bytes

P = lambda title="Masala dosa", lic="by", ver="2.0", creator="Jane Doe", i=1: {
    "id": f"id-{i}", "title": title, "creator": creator, "license": lic, "license_version": ver, "foreign_landing_url": f"https://www.flickr.com/photos/x/{i}"}


class Credit(unittest.TestCase):
    def test_by_names_the_title_the_creator_and_the_licence(self):
        self.assertEqual(credit(P()), '"Masala dosa" by Jane Doe, CC BY 2.0')

    def test_cc0_and_public_domain_are_named_too(self):
        self.assertEqual(credit(P(lic="cc0", ver="1.0")), "Jane Doe, CC0")
        self.assertEqual(credit(P(lic="pdm", ver="1.0", creator=None)), "Public domain")

    def test_a_licence_we_may_not_use_is_refused(self):
        for lic in ("by-sa", "by-nc", "by-nd"):
            with self.assertRaises(ValueError):
                credit(P(lic=lic))
        with self.assertRaises(ValueError):
            credit(P(creator=None))   # CC BY needs the creator

    def test_row_keeps_the_source_for_the_research_file(self):
        r = row(5, P(i=77), "https://store/menu/dream/5.webp", "2026-10-25")
        self.assertEqual((r["dish_n"], r["source_page"], r["license"], r["license_version"], r["creator"], r["image_url"]),
                         (5, "https://www.flickr.com/photos/x/77", "by", "2.0", "Jane Doe", "https://store/menu/dream/5.webp"))
        self.assertEqual(r["image_credit"], '"Masala dosa" by Jane Doe, CC BY 2.0')


class Picture(unittest.TestCase):
    def test_a_big_photo_becomes_a_small_webp_under_the_limit(self):
        import random
        random.seed(1)
        big = Image.effect_noise((2000, 1500), 80).convert("RGB")   # noise is the worst case for size
        data = webp_bytes(big)
        out = Image.open(io.BytesIO(data))
        self.assertEqual(out.format, "WEBP")
        self.assertLessEqual(out.width, 600)
        self.assertLess(len(data), MAX_BYTES)


class Choices(unittest.TestCase):
    def test_twelve_different_photos_one_per_dish_and_both_thalis_among_them(self):
        # owner, 25 Oct: photos cost storage, so at most 12 different pictures, and every dish has one
        self.assertEqual(len(CHOICES), 12)
        self.assertEqual(len({v["id"] for v in CHOICES.values()}), 12)
        self.assertTrue({"13", "14"} <= set(CHOICES))
        for v in CHOICES.values():
            credit(v)   # refuses a licence we may not use

    def test_the_menu_in_the_migration_is_exactly_the_dishes_that_have_a_photo(self):
        sql = (Path(__file__).resolve().parent.parent / "app/supabase/migrations/0038_dish_photos.sql").read_text()
        menu = sql.split("$menu$[")[1].split("]$menu$")[0]
        self.assertEqual(sorted(json.loads(line.rstrip(",").strip())[0] for line in menu.strip().splitlines()), sorted(int(n) for n in CHOICES))


if __name__ == "__main__":
    unittest.main()
