"""Story H15 (#205): the UptimeRobot plan. No network."""
import importlib.util, pathlib, unittest

spec = importlib.util.spec_from_file_location("uptimerobot", pathlib.Path(__file__).resolve().parent.parent / "ops" / "health" / "uptimerobot.py")
u = importlib.util.module_from_spec(spec)
spec.loader.exec_module(u)


class UptimePlan(unittest.TestCase):
    def test_six_monitors_are_wanted_and_all_are_https(self):
        self.assertEqual(len(u.WANTED), 6)
        self.assertTrue(all(url.startswith("https://") for _, url in u.WANTED))

    def test_nothing_is_missing_when_all_six_exist_even_with_other_case_or_no_slash(self):
        have = [url.upper().rstrip("/") for _, url in u.WANTED] + ["https://n8n.linkright.in/healthz"]
        self.assertEqual(u.missing(have), [])

    def test_only_the_absent_ones_are_listed(self):
        have = ["https://goserve-app.pages.dev/customer/", "https://letsdwelo.in"]
        names = [n for n, _ in u.missing(have)]
        self.assertEqual(names, ["GoServe app kitchen", "GoServe app rider", "GoServe app admin", "GoServe dev customer"])

    def test_the_new_monitor_is_an_http_check_every_five_minutes(self):
        b = u.new_monitor_body("K", "GoServe app rider", "https://goserve-app.pages.dev/rider/")
        self.assertEqual((b["type"], b["interval"], b["friendly_name"], b["url"]), (1, 300, "GoServe app rider", "https://goserve-app.pages.dev/rider/"))

    def test_the_script_has_no_delete_or_edit_call(self):
        text = (pathlib.Path(u.__file__)).read_text()
        self.assertNotIn("deleteMonitor", text)
        self.assertNotIn("editMonitor", text)


if __name__ == "__main__":
    unittest.main()
