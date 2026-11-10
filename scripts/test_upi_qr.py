# Story #1263 (epic #1259, board A10): the UPI QR the admin uploads and the rider shows. Every check ends in ROLLBACK. Red run: SKIP_MIG=1.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_upi_qr.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql, migration_inside
from test_order_actions import SETUP, RIDER, ADMIN, CUST, OTHER, who

MIG = migration_inside(["20261110150000_upi_qr.sql"], "to_regproc('public.upi_qr_set_v2') is not null")
GOOD = "https://x.supabase.co/storage/v1/object/public/upi-qr/qr-1.png"


def run(*steps, final=""):
    def flatten(x):
        return [y for e in x for y in flatten(e)] if isinstance(x, list) else [x]
    flat = flatten(list(steps))
    last = "reset role; select (select jsonb_agg(r order by i) from res) as rs" + (", " + final if final else "")
    r = sql("begin; " + "; ".join(([MIG] if MIG else []) + SETUP + flat + [last]) + "; rollback;")
    return r[-1] if isinstance(r, list) else r


def put(uid, url):
    return who(uid) + [f"insert into res (r) select upi_qr_set_v2('{url}')"]


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class UpiQr(unittest.TestCase):
    def test_q1_no_qr_is_null_until_an_admin_sets_one_and_a_rider_reads_it(self):
        r = run(who(RIDER), "insert into res (r) select to_jsonb(upi_qr_url())", put(ADMIN, GOOD), who(RIDER), "insert into res (r) select to_jsonb(upi_qr_url())")
        self.assertEqual((r["rs"][0], r["rs"][1]["ok"], r["rs"][2]), (None, True, GOOD), r)

    def test_q2_only_an_admin_sets_it(self):
        self.assertIn("not_admin", str(run(put(OTHER, GOOD))))
        self.assertIn("not_admin", str(run(put(CUST, GOOD))))

    def test_q3_an_address_outside_the_bucket_is_refused(self):
        for bad in ["http://x.supabase.co/storage/v1/object/public/upi-qr/a.png", "https://x.supabase.co/storage/v1/object/public/menu/a.png", "https://evil.test/a.png", "https://x.supabase.co/storage/v1/object/public/upi-qr/../menu/a.png"]:
            self.assertEqual(run(put(ADMIN, bad))["rs"][0]["error"], "invalid_url", bad)

    def test_q4_the_admin_reads_who_and_when_and_a_non_admin_cannot(self):
        r = run(put(ADMIN, GOOD), who(ADMIN), "insert into res (r) select upi_qr_get_v2()")
        self.assertEqual((r["rs"][1]["url"], r["rs"][1]["updated_at"] is not None), (GOOD, True), r)
        self.assertIn("not_admin", str(run(who(RIDER), "select upi_qr_get_v2()")))

    def test_q5_only_an_admin_can_write_a_picture_into_the_bucket(self):
        ins = "insert into storage.objects (bucket_id, name) values ('upi-qr', 'qr-t.png')"
        self.assertIn("row-level security", str(run(who(OTHER), ins)))
        self.assertEqual(run(who(ADMIN), ins, "reset role")["rs"], None)


if __name__ == "__main__":
    unittest.main()
