"""Story #251: the APK's version comes from the release tag. Run: python3 scripts/test_apk_version.py"""
import json, tempfile, unittest
from pathlib import Path
import apk_version as av


class Version(unittest.TestCase):
    def test_tag_gives_name_and_a_code_that_grows(self):
        self.assertEqual(av.parse("v1.2.3"), ("1.2.3", 1002003))
        self.assertEqual(av.parse("2.0.0"), ("2.0.0", 2000000))
        self.assertLess(av.parse("v1.9.9")[1], av.parse("v1.10.0")[1])

    def test_a_bad_tag_is_refused(self):
        for bad in ["", "v1", "v1.2", "1.2.3-rc1", "latest", "v1.2.3.4", "v1000.0.0", "v1.1000.0"]:
            with self.assertRaises(ValueError, msg=bad):
                av.parse(bad)

    def test_the_manifest_gets_the_version(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "twa-manifest.json"
            p.write_text(json.dumps({"packageId": "in.goserve.customer", "appVersionName": "1", "appVersionCode": 1, "appVersion": "1"}))
            av.patch(p, "v1.4.2")
            m = json.loads(p.read_text())
            self.assertEqual((m["appVersionName"], m["appVersionCode"], m["appVersion"]), ("1.4.2", 1004002, "1.4.2"))
            self.assertEqual(m["packageId"], "in.goserve.customer")


if __name__ == "__main__":
    unittest.main()
