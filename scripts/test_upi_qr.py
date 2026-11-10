# Story #1263 (epic #1259, board A10): the UPI QR the admin uploads and the rider shows. The setting holds an object name in the upi-qr bucket, never an address.
# Every check ends in ROLLBACK. Red run: SKIP_MIG=1.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_upi_qr.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql, migration_inside
from test_order_actions import SETUP, RIDER, ADMIN, CUST, OTHER, who

MIG = migration_inside(["20261110150000_upi_qr.sql"], "to_regproc('public.upi_qr_set_v2') is not null")
OBJ = "qr-0a1b2c3d-0000-4000-8000-0123456789ab.png"
PUT = f"insert into storage.objects (bucket_id, name) values ('upi-qr', '{OBJ}')"


def run(*steps, final=""):
    def flatten(x):
        return [y for e in x for y in flatten(e)] if isinstance(x, list) else [x]
    flat = flatten(list(steps))
    last = "reset role; select (select jsonb_agg(r order by i) from res) as rs" + (", " + final if final else "")
    r = sql("begin; " + "; ".join(([MIG] if MIG else []) + SETUP + flat + [last]) + "; rollback;")
    return r[-1] if isinstance(r, list) else r


def put(uid, obj=OBJ):
    return who(uid) + [f"insert into res (r) select upi_qr_set_v2('{obj}')"]


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class UpiQr(unittest.TestCase):
    def test_q1_no_qr_is_null_until_an_admin_sets_an_uploaded_one_and_a_rider_reads_the_name(self):
        r = run(who(RIDER), "insert into res (r) select to_jsonb(upi_qr_object())", who(ADMIN), PUT, put(ADMIN), who(RIDER), "insert into res (r) select to_jsonb(upi_qr_object())")
        self.assertEqual((r["rs"][0], r["rs"][1]["ok"], r["rs"][2]), (None, True, OBJ), r)

    def test_q2_only_an_admin_sets_it(self):
        self.assertIn("not_admin", str(run(put(OTHER))))
        self.assertIn("not_admin", str(run(put(CUST))))

    def test_q3_an_address_a_foreign_host_a_path_trick_or_an_object_that_is_not_there_is_refused(self):
        for bad in ["https://x.supabase.co/storage/v1/object/public/upi-qr/" + OBJ, "https://evil.test/" + OBJ, "../menu/" + OBJ, "qr-x.png", OBJ.replace("0a1b", "ffff")]:
            self.assertEqual(run(who(ADMIN), PUT, put(ADMIN, bad))["rs"][0]["error"], "invalid_object", bad)

    def test_q4_an_object_with_the_right_name_in_another_bucket_is_refused(self):
        other = f"insert into storage.objects (bucket_id, name) values ('menu', '{OBJ}')"
        self.assertEqual(run(who(ADMIN), other, put(ADMIN))["rs"][0]["error"], "invalid_object")

    def test_q5_the_admin_reads_who_and_when_and_a_non_admin_cannot(self):
        r = run(who(ADMIN), PUT, put(ADMIN), who(ADMIN), "insert into res (r) select upi_qr_get_v2()")
        self.assertEqual((r["rs"][1]["object"], r["rs"][1]["updated_at"] is not None), (OBJ, True), r)
        self.assertIn("not_admin", str(run(who(RIDER), "select upi_qr_get_v2()")))

    def test_q6_every_change_is_logged_and_only_an_admin_reads_the_log(self):
        r = run(who(ADMIN), PUT, put(ADMIN), who(ADMIN), "insert into res (r) select to_jsonb(count(*)) from upi_qr_log", who(OTHER), "insert into res (r) select to_jsonb(count(*)) from upi_qr_log")
        self.assertEqual((r["rs"][1], r["rs"][2]), (1, 0), r)   # the admin sees the row, another user sees none

    def test_q6b_the_same_name_again_changes_nothing_and_logs_nothing(self):
        r = run(who(ADMIN), PUT, put(ADMIN), put(ADMIN), final="(select count(*) from upi_qr_log) as logs")
        self.assertEqual(([x["changed"] for x in r["rs"]], r["logs"]), ([True, False], 1), r)

    def test_q6c_anon_cannot_call_upi_qr_object(self):
        self.assertIn("permission denied", str(run("set local role anon", "select upi_qr_object()")))

    def test_q7_only_an_admin_can_write_a_picture_into_the_bucket(self):
        self.assertIn("row-level security", str(run(who(OTHER), PUT)))

    def test_q8_the_bucket_holds_at_most_2_mb_of_png_jpeg_or_webp(self):
        r = run(final="(select file_size_limit from storage.buckets where id = 'upi-qr') as lim, (select allowed_mime_types from storage.buckets where id = 'upi-qr') as types")
        self.assertEqual((r["lim"], sorted(r["types"])), (2097152, ["image/jpeg", "image/png", "image/webp"]), r)

    def test_q9_payment_methods_on_leaves_upi_out_while_no_qr_is_set_and_has_it_once_one_is(self):
        r = run("set local role anon", "insert into res (r) select payment_methods_on()", "reset role", who(ADMIN), PUT, put(ADMIN), "set local role anon", "insert into res (r) select payment_methods_on()")
        self.assertEqual((r["rs"][0], r["rs"][2]), (["cash"], ["cash", "upi_door"]), r)

    def test_q10_cash_cannot_go_off_while_no_qr_is_set_and_can_once_one_is(self):
        off = who(ADMIN) + ["insert into res (r) select payment_methods_set_v2('cash', false)"]
        r = run(off, who(ADMIN), PUT, put(ADMIN), off, final="(select value from settings where name = 'payment_methods') as pm")
        self.assertEqual((r["rs"][0]["error"], r["rs"][0]["message"], r["rs"][2]["ok"], r["pm"]), ("qr_missing", "Upload the UPI QR first.", True, ["upi_door"]), r)

    def test_q11_a_picture_in_the_bucket_cannot_be_replaced_or_deleted_even_by_an_admin(self):
        r = run(who(ADMIN), PUT, "with u as (update storage.objects set name = 'qr-changed.png' where bucket_id = 'upi-qr' returning 1) insert into res (r) select to_jsonb(count(*)) from u",
                final=f"(select count(*) from storage.objects where bucket_id = 'upi-qr' and name = '{OBJ}') as still, (select count(*) from pg_policies where tablename = 'objects' and policyname in ('upi_qr_update', 'upi_qr_delete')) as writers")
        self.assertEqual((r["rs"], r["still"], r["writers"]), ([0], 1, 0), r)   # an admin update changes no row; no update or delete policy exists
        # a delete is refused: no policy allows it, and the platform also refuses direct deletes from its storage tables
        self.assertIn("Direct deletion", str(run(who(ADMIN), PUT, "delete from storage.objects where bucket_id = 'upi-qr'")))

if __name__ == "__main__":
    unittest.main()
