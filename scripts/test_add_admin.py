"""Story A1 (#148): the SQL that makes a Google user an admin. No network."""
import unittest
from add_admin import build_sql


class AddAdmin(unittest.TestCase):
    def test_finds_the_user_by_email_and_inserts_one_row(self):
        q = build_sql("Founder@Example.com")
        self.assertIn("lower(email) = 'founder@example.com'", q)
        self.assertIn("insert into admins (user_id)", q)
        self.assertIn("on conflict do nothing", q)
        self.assertIn("returning user_id", q)

    def test_a_bad_email_is_refused_before_any_sql(self):
        for email in ["a'; drop table orders;--@x.com", "not-an-email", ""]:
            with self.assertRaises(ValueError):
                build_sql(email)


if __name__ == "__main__":
    unittest.main()
