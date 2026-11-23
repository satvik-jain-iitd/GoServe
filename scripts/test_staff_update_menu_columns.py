# Story 944: a kitchen staff user may change only available and back_soon_at of a dish of their own kitchen.
# Every check ends in ROLLBACK (dev stays clean). SKIP_MIG=1 is the red run before the migration.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_staff_update_menu_columns.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, migration_inside, sql

FILE = "20261124140000_staff_update_menu_columns.sql"
MIG = migration_inside([FILE], "exists (select 1 from pg_trigger where tgname = 'menu_items_staff_columns')")
K1, K2 = "'00000000-0000-0000-0000-0000000000f1'", "'00000000-0000-0000-0000-0000000000f2'"
D1, D2 = "'00000000-0000-0000-0000-0000000000f3'", "'00000000-0000-0000-0000-0000000000f4'"
U = "'00000000-0000-0000-0000-0000000000f5'"
SETUP = [
    f"insert into auth.users (id, aud, role) values ({U}, 'authenticated', 'authenticated')",
    f"insert into kitchens (id, name, pin_codes) values ({K1}, 'Mine', array['110016']), ({K2}, 'Other', array['110016'])",
    f"insert into menu_items (id, kitchen_id, name, price_paise) values ({D1}, {K1}, 'Thali', 14000), ({D2}, {K2}, 'Dal', 9000)",
    f"insert into kitchen_staff (kitchen_id, user_id) values ({K1}, {U})",
]
AS_STAFF = ["set local role authenticated", "select set_config('request.jwt.claims', '{\"sub\":\"00000000-0000-0000-0000-0000000000f5\",\"role\":\"authenticated\"}', true)"]


A = "'00000000-0000-0000-0000-0000000000f6'"
ADMIN_SETUP = [f"insert into auth.users (id, aud, role) values ({A}, 'authenticated', 'authenticated')", f"insert into admins (user_id) values ({A})"]
AS_ADMIN = ["set local role authenticated", "select set_config('request.jwt.claims', '{\"sub\":\"00000000-0000-0000-0000-0000000000f6\",\"role\":\"authenticated\"}', true)"]


def run(stmt, admin=False):
    """Runs the update as the staff user; answers rows changed, the database error if any, and the dish's price and flag after."""
    body = "; ".join(([MIG] if MIG else []) + SETUP + (ADMIN_SETUP + AS_ADMIN if admin else AS_STAFF) + [
        "create temp table res (n int, err text)",
        f"do $x$ declare c int; begin {stmt}; get diagnostics c = row_count; insert into res values (c, null); exception when others then insert into res values (0, sqlerrm); end $x$",
        "reset role", f"select n, err, (select price_paise from menu_items where id = {D1}) as p, (select available from menu_items where id = {D1}) as a from res"])
    r = sql("begin; " + body + "; rollback;")
    assert isinstance(r, list), r
    return r[-1]


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class StaffUpdateMenuColumns(unittest.TestCase):
    def test_s1_staff_can_flip_available_of_their_own_dish(self):
        r = run(f"update menu_items set available = false where id = {D1}")
        self.assertEqual((r["n"], r["a"]), (1, False), r)

    def test_s2_staff_cannot_change_the_price_name_or_kitchen(self):
        for col in ("price_paise = 1", "name = 'Free'", "sort = 99", "synthetic = true"):
            r = run(f"update menu_items set {col} where id = {D1}")
            self.assertEqual((r["n"], r["p"]), (0, 14000), (col, r))

    def test_s3_staff_cannot_touch_another_kitchens_dish(self):
        r = run(f"update menu_items set available = false where id = {D2}")
        self.assertEqual(r["n"], 0, r)

    def test_s4_an_admin_still_changes_price_and_name(self):   # the admin app's setDish (app/src/lib/admin.ts) runs as an admin: it must keep working
        r = run(f"update menu_items set price_paise = 15000, name = 'Thali Plus' where id = {D1}", admin=True)
        self.assertEqual((r["n"], r["p"]), (1, 15000), r)

    def test_s5_the_kitchen_tools_path_sold_out_and_back_in_stock_still_works(self):   # app/src/screens/KitchenTools.tsx stock() -> setDish(..., { available }) = update menu_items set available, as the staff user
        out = run(f"update menu_items set available = false where id = {D1}")
        self.assertEqual((out["n"], out["a"]), (1, False), out)
        back = run(f"update menu_items set available = true, back_soon_at = now() + interval '1 hour' where id = {D1}")   # the stock flip with a back-soon time in one update
        self.assertEqual((back["n"], back["a"]), (1, True), back)
