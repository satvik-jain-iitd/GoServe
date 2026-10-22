"""Story S-M5 (#132): the SQL that lists a Google user as kitchen staff. No network."""
import unittest
from add_kitchen_staff import REFS, build_sql

K = "11111111-2222-4333-8444-555555555555"


class AddKitchenStaff(unittest.TestCase):
    def test_finds_the_user_by_email_and_inserts_one_row(self):
        q = build_sql("Asha@Example.com", K)
        self.assertIn("lower(email) = 'asha@example.com'", q)
        self.assertIn(f"'{K}'", q)
        self.assertIn("on conflict do nothing", q)
        self.assertIn("returning kitchen_id, user_id", q)

    def test_a_bad_email_or_kitchen_id_is_refused_before_any_sql(self):
        for email, kid in [("a'; drop table orders;--@x.com", K), ("not-an-email", K), ("a@x.com", "k-1"), ("a@x.com", K + "'")]:
            with self.assertRaises(ValueError):
                build_sql(email, kid)

    def test_both_projects_are_known(self):
        self.assertEqual(set(REFS), {"dev", "prod"})


if __name__ == "__main__":
    unittest.main()
