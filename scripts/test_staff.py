# Story #468 (E27): one person can own one kitchen and work in another, with one sign-in.
# Scenarios: (1) staff of kitchen A, the admin adds them to kitchen B: both memberships exist, no error. (2) a person of kitchen A only calls a kitchen B step: not allowed.
# (3) a person with two kitchens asks for my kitchens: both come back with their roles.
# Every check ends in ROLLBACK (dev stays clean). Needs SUPABASE_ACCESS_TOKEN (vault 02_databases.env); skipped without it.
# Run: set -a; . ~/Desktop/Secrets/02_databases.env; set +a; python3 -m unittest scripts/test_staff.py
import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_schema import TOKEN, sql
from test_payments import O, CUST, KITCHEN, OTHER, SETUP, q, run, act

KA = "00000000-0000-0000-0000-0000000000b1"   # the kitchen of the shared setup (KITCHEN is its staff)
KB = "00000000-0000-0000-0000-0000000000b2"
ADMIN = "00000000-0000-0000-0000-0000000000ad"
PREP = [f"insert into auth.users (id) values ('{ADMIN}')", f"insert into admins (user_id) values ('{ADMIN}')", f"insert into kitchens (id, name, pin_codes) values ('{KB}', 'B', array['110017'])"]
MEMBERS = f"(select coalesce(jsonb_agg(jsonb_build_object('k', kitchen_id, 'role', role) order by kitchen_id), '[]'::jsonb) from kitchen_staff where user_id = '{KITCHEN}') as members"


def add(kitchen=KB, user=KITCHEN, role="staff", actor=ADMIN):
    return q(f"staff_add_v2('{actor}', '{kitchen}', '{user}', '{role}')")


def remove(kitchen=KB, user=KITCHEN, actor=ADMIN):
    return q(f"staff_remove_v2('{actor}', '{kitchen}', '{user}')")


def mine(user=KITCHEN):
    return q(f"my_kitchens_v2('{user}')")


@unittest.skipUnless(TOKEN, "SUPABASE_ACCESS_TOKEN not set")
class Staff(unittest.TestCase):
    def test_the_admin_adds_a_second_kitchen_and_both_memberships_exist_no_error(self):
        r = run(PREP, add(), final=MEMBERS)
        self.assertEqual(r["rs"][0], {"ok": True}, r)
        self.assertEqual(sorted(m["k"] for m in r["members"]), [KA, KB], r)

    def test_a_person_can_own_one_kitchen_and_work_in_another(self):
        r = run(PREP, add(KA, KITCHEN, "owner"), add(KB, KITCHEN, "staff"), mine())
        self.assertEqual([m["role"] for m in sorted(r["rs"][2]["kitchens"], key=lambda m: m["kitchen_id"])], ["owner", "staff"], r)

    def test_adding_the_same_membership_again_changes_the_role_and_adds_nothing(self):
        r = run(PREP, add(KB, KITCHEN, "staff"), add(KB, KITCHEN, "owner"), final=MEMBERS)
        self.assertEqual(sorted(m["role"] for m in r["members"] if m["k"] == KB), ["owner"], r)
        self.assertEqual(len(r["members"]), 2, r)

    def test_removing_one_membership_leaves_the_others(self):
        r = run(PREP, add(), remove(), remove(), final=MEMBERS)
        self.assertEqual(r["rs"][1], {"ok": True}, r)
        self.assertEqual(r["rs"][2]["error"], "membership_not_found", r)
        self.assertEqual([m["k"] for m in r["members"]], [KA], r)

    def test_my_kitchens_lists_both_with_their_roles_and_names_and_the_old_role_reads_staff(self):
        r = run(PREP, add(), mine())
        got = {k["kitchen_id"]: (k["name"], k["role"]) for k in r["rs"][1]["kitchens"]}
        self.assertEqual(got, {KA: ("Test", "staff"), KB: ("B", "staff")}, r)   # the setup row has the old role "kitchen", which reads as staff
        self.assertEqual(run(mine(OTHER))["rs"][0], {"ok": True, "kitchens": []})

    def test_a_person_of_kitchen_a_only_cannot_act_on_a_kitchen_b_order(self):
        order_b = f"insert into orders (id, kitchen_id, session_id, client_order_key, items, total_paise, address) values ('{O[:-1]}b', '{KB}', '{CUST}', 'kb', '[]', 100, 'x')"
        r = run(PREP, order_b, act(KITCHEN, "accept", order=O[:-1] + "b"), act(KITCHEN, "accept"))
        self.assertEqual((r["rs"][0]["error"], r["rs"][1]["ok"]), ("not_allowed", True), r)

    def test_after_the_admin_adds_kitchen_b_that_person_can_act_there(self):
        order_b = f"insert into orders (id, kitchen_id, session_id, client_order_key, items, total_paise, address) values ('{O[:-1]}b', '{KB}', '{CUST}', 'kb', '[]', 100, 'x')"
        r = run(PREP, order_b, add(), act(KITCHEN, "accept", order=O[:-1] + "b"))
        self.assertEqual(r["rs"][1]["ok"], True, r)

    def test_only_an_admin_adds_or_removes_and_the_inputs_are_checked(self):
        r = run(PREP, add(actor=OTHER), remove(actor=OTHER), add(role="boss"), add(kitchen="00000000-0000-0000-0000-00000000dead"), add(user="00000000-0000-0000-0000-00000000dead"), final=MEMBERS)
        self.assertEqual([x["error"] for x in r["rs"]], ["not_allowed", "not_allowed", "invalid_role", "kitchen_not_found", "user_not_found"], r)
        self.assertEqual([m["k"] for m in r["members"]], [KA], r)

    def test_nobody_calls_the_functions_by_hand(self):
        for role in ("anon", "authenticated"):
            for stmt in (f"select staff_add_v2('{ADMIN}', '{KB}', '{KITCHEN}', 'staff')", f"select staff_remove_v2('{ADMIN}', '{KB}', '{KITCHEN}')", f"select my_kitchens_v2('{KITCHEN}')"):
                r = sql("begin; " + "; ".join(SETUP + [f"set local role {role}", stmt]) + "; rollback;")
                self.assertIn("permission denied", str(r), (role, stmt))


if __name__ == "__main__":
    unittest.main()
