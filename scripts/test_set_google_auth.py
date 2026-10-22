"""Story S-M1 (#117): the Supabase auth settings for Google sign-in. No network, no secrets."""
import unittest
from set_google_auth import REFS, build_payload, plan


class GoogleAuth(unittest.TestCase):
    def test_payload_turns_google_and_manual_linking_on(self):
        p = build_payload("dev", "cid.apps.googleusercontent.com", "sec")
        self.assertEqual(p["external_google_enabled"], True)
        self.assertEqual(p["external_google_client_id"], "cid.apps.googleusercontent.com")
        self.assertEqual(p["external_google_secret"], "sec")
        self.assertEqual(p["security_manual_linking_enabled"], True)

    def test_after_google_the_phone_returns_to_the_app_not_localhost(self):
        dev, prod = build_payload("dev", "c", "s"), build_payload("prod", "c", "s")
        self.assertEqual(dev["site_url"], "https://goserve-app-dev.vercel.app")
        self.assertEqual(prod["site_url"], "https://goserve-app.pages.dev")
        self.assertIn("https://goserve-app-dev.vercel.app/**", dev["uri_allow_list"])
        self.assertIn("http://localhost:5173/**", dev["uri_allow_list"])
        self.assertIn("https://goserve-app.pages.dev/**", prod["uri_allow_list"])
        self.assertNotIn("localhost", prod["uri_allow_list"])
        self.assertNotIn("localhost", prod["site_url"])

    def test_plan_never_shows_the_secret(self):
        text = plan("dev", build_payload("dev", "cid", "TOPSECRET"))
        self.assertNotIn("TOPSECRET", text)
        self.assertIn(REFS["dev"], text)

    def test_missing_client_is_refused(self):
        with self.assertRaises(ValueError):
            build_payload("dev", "", "sec")

    def test_both_projects_are_known(self):
        self.assertEqual(set(REFS), {"dev", "prod"})


if __name__ == "__main__":
    unittest.main()
