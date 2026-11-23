# Story 944 (slice b): riders_staff_read lets a kitchen read only the riders on its own orders (name, phone), not every rider.
# Every check ends in ROLLBACK (dev stays clean), with throwaway users. SKIP_MIG=1 runs against the database as it is (the red run).
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_riders_read_scope.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql

HERE = os.path.dirname(os.path.abspath(__file__))
MIGS = [] if os.environ.get("SKIP_MIG") else [open(os.path.join(HERE, "..", "supabase", "migrations", "20261124180000_riders_read_scope.sql")).read()]
CUS, RID, RID2, RID3, KIT_U, KIT_U2, ADM = ("00000000-0000-0000-0000-0000000000c%d" % i for i in range(1, 8))
KIT, KIT2 = "00000000-0000-0000-0000-0000000000f3", "00000000-0000-0000-0000-0000000000f4"
O1, O2, O3 = ("00000000-0000-0000-0000-0000000000b%d" % i for i in range(1, 4))
IDS = ",".join(f"'{r}'" for r in (RID, RID2, RID3))
NAMES = {RID: "Rider One", RID2: "Rider Two", RID3: "Rider Three"}

SETUP = [f"insert into auth.users (id, email, aud, role, instance_id) values ('{u}', '{u}@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')"
         for u in (CUS, RID, RID2, RID3, KIT_U, KIT_U2, ADM)] + [
    f"insert into admins (user_id) values ('{ADM}')",
    f"insert into kitchens (id, name, pin_codes) values ('{KIT}', 'Test kitchen', array['110016']), ('{KIT2}', 'Other kitchen', array['110017'])",
    f"insert into riders (user_id, name, phone) values ('{RID}', 'Rider One', '9111111111'), ('{RID2}', 'Rider Two', '9222222222'), ('{RID3}', 'Rider Three', '9333333333')",
    f"insert into kitchen_staff (kitchen_id, user_id, role) values ('{KIT}', '{KIT_U}', 'kitchen'), ('{KIT2}', '{KIT_U2}', 'kitchen')"] + [
    f"insert into orders (id, kitchen_id, session_id, client_order_key, items, total_paise, address, customer_phone) values ('{o}', '{k}', '{CUS}', 'k{o[-1]}', '[]', 100, 'x', '9000000000')"
    for o, k in ((O1, KIT), (O2, KIT2), (O3, KIT2))] + [
    f"update orders set rider_id = '{RID}' where id in ('{O1}', '{O2}')",   # one rider works for both kitchens
    f"update orders set rider_id = '{RID2}' where id = '{O3}'",
    "create temp table res (i serial, r jsonb)", "grant all on res to public", "grant all on res_i_seq to public"]


def read_as(uid):
    return ["reset role", "set local role authenticated", f"select set_config('request.jwt.claims', '{{\"sub\":\"{uid}\",\"role\":\"authenticated\"}}', true)",
            f"insert into res (r) select coalesce(jsonb_agg(name order by name), '[]') from riders where user_id in ({IDS})"]


def run(*steps):
    flat = [s for st in steps for s in (st if isinstance(st, list) else [st])]
    r = sql("begin; " + "; ".join(MIGS + SETUP + flat + ["reset role", "select jsonb_agg(r order by i) as rs from res"]) + "; rollback;")
    assert isinstance(r, list), r
    return r[-1]["rs"]


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class RidersReadScope(unittest.TestCase):
    def test_kitchen_reads_only_riders_on_its_own_orders(self):
        rs = run(read_as(KIT_U), read_as(KIT_U2))
        self.assertEqual(rs[0], ["Rider One"], rs)               # KIT has one order, with Rider One
        self.assertEqual(rs[1], ["Rider One", "Rider Two"], rs)  # KIT2 has two orders, with both

    def test_guard1_a_rider_of_another_kitchen_is_still_read_by_name_on_my_order(self):
        rs = run(read_as(KIT_U))  # Rider One also works for KIT2 but is on KIT's order O1, so KIT still sees the name
        self.assertIn("Rider One", rs[0], rs)
        self.assertNotIn("Rider Two", rs[0], rs)
        self.assertNotIn("Rider Three", rs[0], rs)

    def test_a_kitchen_with_no_rider_order_reads_no_rider(self):
        rs = run(f"delete from orders where kitchen_id = '{KIT}'", read_as(KIT_U))
        self.assertEqual(rs[0], [], rs)

    def test_admin_reads_all(self):
        self.assertEqual(run(read_as(ADM))[0], sorted(NAMES.values()))

    def test_a_rider_reads_own_row_only(self):
        self.assertEqual(run(read_as(RID))[0], ["Rider One"])

    def test_a_customer_reads_none(self):
        self.assertEqual(run(read_as(CUS))[0], [])

    def test_guard2_customer_rider_card_still_answers(self):
        r = sql("begin; " + "; ".join(MIGS + SETUP + [f"update orders set status='accepted' where id='{O1}'", f"update orders set status='preparing' where id='{O1}'",
                f"update orders set status='ready' where id='{O1}'", "reset role", "set local role authenticated",
                f"select set_config('request.jwt.claims', '{{\"sub\":\"{CUS}\",\"role\":\"authenticated\"}}', true)",
                f"select name, phone from order_rider('{O1}')"]) + "; rollback;")
        self.assertEqual((r[-1]["name"], r[-1]["phone"]), ("Rider", "9111111111"), r)


if __name__ == "__main__":
    unittest.main()
