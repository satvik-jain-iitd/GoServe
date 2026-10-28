"""Story #302: the privacy page names every personal item the database keeps, and lists nothing the database does not keep.
Run: python3 scripts/test_privacy_page.py"""
import re, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGE = (ROOT / "app/public/privacy/index.html").read_text().lower()
SQL = "\n".join(p.read_text() for p in sorted((ROOT / "app/supabase/migrations").glob("*.sql")))
SQL_LOWER = re.sub(r"--[^\n]*", "", SQL.lower())   # comments out

# (table, column) -> the words the page must contain for it. A new personal column must be added here, or the test below fails.
KEPT = {
    ("orders", "address"): "delivery address",
    ("orders", "customer_name"): "name and phone",
    ("orders", "customer_phone"): "name and phone",
    ("orders", "pin_code"): "pin code",
    ("customers", "name"): "name and phone",
    ("customers", "phone"): "name and phone",
    ("customers", "address"): "saved address",
    ("customers", "pin_code"): "pin code",
    ("riders", "name"): "riders",
    ("riders", "phone"): "riders",
    ("riders", "lat"): "place while",
    ("riders", "lng"): "place while",
    ("rider_pings", "lat"): "30 days",
    ("rider_pings", "lng"): "30 days",
    ("push_subscriptions", "endpoint"): "notification",
}
PERSONAL_NAMES = {"name", "phone", "address", "email", "lat", "lng", "pin_code", "customer_name", "customer_phone", "endpoint"}
NOT_PERSONAL = {"kitchens", "menu_items", "pin_points", "dish_photos", "zone_state", "params"}   # kitchen and map data, no person


def columns():
    cols = set()
    for t, body in re.findall(r"create table (?:if not exists )?(\w+)\s*\((.*?)\);", SQL_LOWER, re.S):
        for line in re.split(r",\s*(?![^()]*\))", body):
            m = re.match(r"\s*(\w+)\s+\w+", line)
            if m: cols.add((t, m.group(1)))
    for t, body in re.findall(r"alter table (\w+)\s+(add column.*?);", SQL_LOWER, re.S):
        for c in re.findall(r"add column (?:if not exists )?(\w+)", body): cols.add((t, c))
    return cols


class Privacy(unittest.TestCase):
    def test_every_listed_item_is_in_the_schema(self):
        have = columns()
        for item in KEPT:
            self.assertIn(item, have, f"{item} is on the privacy list but the schema has no such column")

    def test_no_personal_column_is_missing_from_the_list(self):
        for t, c in sorted(columns()):
            if c in PERSONAL_NAMES and t not in NOT_PERSONAL:
                self.assertIn((t, c), KEPT, f"{t}.{c} looks personal and is not on the privacy list")

    def test_the_page_says_it_in_plain_words(self):
        for item, words in KEPT.items():
            self.assertIn(words, PAGE, f"the page does not say '{words}' (for {item})")

    def test_the_page_says_how_to_delete_and_who_to_write_to(self):
        self.assertIn("delete", PAGE)
        self.assertIn("avinturetech@gmail.com", PAGE)

    def test_the_page_is_linked_from_the_app(self):
        self.assertIn('href="/privacy/"', (ROOT / "app/src/screens/AccountScreen.tsx").read_text())


if __name__ == "__main__":
    unittest.main()
