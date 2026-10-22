"""Story S-M1 (#117): the Supabase auth settings for Google sign-in. No network, no secrets."""
import unittest
from set_google_auth import REFS, build_payload, plan


class GoogleAuth(unittest.TestCase):
    def test_payload_turns_google_and_manual_linking_on(self):
        p = build_payload("cid.apps.googleusercontent.com", "sec")
        self.assertEqual(p, {"external_google_enabled": True, "external_google_client_id": "cid.apps.googleusercontent.com",
                             "external_google_secret": "sec", "security_manual_linking_enabled": True})

    def test_plan_never_shows_the_secret(self):
        text = plan("dev", build_payload("cid", "TOPSECRET"))
        self.assertNotIn("TOPSECRET", text)
        self.assertIn(REFS["dev"], text)

    def test_missing_client_is_refused(self):
        with self.assertRaises(ValueError):
            build_payload("", "sec")

    def test_both_projects_are_known(self):
        self.assertEqual(set(REFS), {"dev", "prod"})


if __name__ == "__main__":
    unittest.main()
