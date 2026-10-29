# Story #354 (E27, plan v2 B.18): a customer rates the food and the rider of a delivered order.
# Scenario: Given a delivered order, when a rating is posted, then food and rider scores are stored.
# Every check ends in ROLLBACK (dev stays clean). Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_ratings.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql
from test_payments import O, CUST, OTHER, SETUP, q, run

RIDER = "00000000-0000-0000-0000-0000000000a9"
def walk(*extra):   # the status steps are checked by a trigger: placed has to pass every step
    return [f"update orders set status = '{s}' where id = '{O}'" for s in ("accepted", "preparing", "ready")] + list(extra) + [f"update orders set status = '{s}' where id = '{O}'" for s in ("out_for_delivery", "delivered")]


DELIVERED = [f"insert into auth.users (id) values ('{RIDER}')", f"insert into riders (user_id, name) values ('{RIDER}', 'Test rider')"] + walk(f"update orders set rider_id = '{RIDER}' where id = '{O}'")
NO_RIDER = walk()
STORED = f"(select row_to_json(r) from (select food_score, rider_score, comment from order_ratings where order_id = '{O}') r) as stored, (select count(*) from order_ratings where order_id = '{O}') as n"


def rate(food=5, rider=4, comment="null", session=CUST, order=O):
    c = comment if comment == "null" else f"'{comment}'"
    r = "null" if rider is None else rider
    return q(f"rate_order_v2('{order}', '{session}', {food}, {r}, {c})")


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class Ratings(unittest.TestCase):
    def test_a_delivered_order_is_rated_and_both_scores_are_stored(self):
        r = run(DELIVERED, rate(5, 4, "Hot and on time"), final=STORED)
        self.assertEqual(r["rs"][0], {"ok": True}, r)
        self.assertEqual(r["stored"], {"food_score": 5, "rider_score": 4, "comment": "Hot and on time"}, r)

    def test_an_order_with_no_rider_takes_a_food_score_only(self):
        r = run(NO_RIDER, rate(3, None), rate(3, 4), final=STORED)
        self.assertEqual(r["rs"][0], {"ok": True}, r)
        self.assertEqual((r["rs"][1]["error"], r["n"]), ("no_rider", 1), r)   # the second call is refused and the stored one stays

    def test_an_order_that_is_not_delivered_cannot_be_rated(self):
        r = run(rate(), final=STORED)
        self.assertEqual((r["rs"][0]["error"], r["n"]), ("not_delivered", 0), r)

    def test_only_the_customer_who_placed_the_order_can_rate_it(self):
        r = run(DELIVERED, rate(session=OTHER), rate(order="00000000-0000-0000-0000-00000000dead"), final=STORED)
        self.assertEqual([x["error"] for x in r["rs"]], ["order_not_found", "order_not_found"], r)

    def test_one_rating_per_order(self):
        r = run(DELIVERED, rate(5, 5), rate(1, 1), final=STORED)
        self.assertEqual((r["rs"][1]["error"], r["stored"]["food_score"]), ("already_rated", 5), r)

    def test_scores_are_one_to_five_and_the_comment_is_short(self):
        r = run(DELIVERED, rate(0, 4), rate(6, 4), rate(5, 0), rate(5, 6), rate(5, 5, "x" * 501), final=STORED)
        self.assertEqual([x["error"] for x in r["rs"]], ["invalid_score"] * 4 + ["invalid_comment"], r)
        self.assertEqual(r["n"], 0)

    def test_nobody_reads_the_table_by_hand_and_only_the_service_role_rates(self):
        for role in ("anon", "authenticated"):
            for stmt in ("select count(*) from order_ratings", f"select rate_order_v2('{O}', '{CUST}', 5, 5, null)"):
                r = sql("begin; " + "; ".join(SETUP + [f"set local role {role}", stmt]) + "; rollback;")
                self.assertIn("permission denied", str(r), (role, stmt))


if __name__ == "__main__":
    unittest.main()
