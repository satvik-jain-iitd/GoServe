"""Story #252: an app's start page must sit inside its scope, or the TWA opens out of scope (a browser tab) and the screen-off test measures the wrong thing.
Run: python3 scripts/test_twa_manifests.py"""
import json, unittest
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent / "ops/android"


class Scope(unittest.TestCase):
    def test_every_start_url_is_inside_its_full_scope_url(self):
        manifests = sorted(ROOT.glob("*/twa-manifest.json"))
        self.assertGreaterEqual(len(manifests), 2)   # customer and rider
        for p in manifests:
            m = json.loads(p.read_text())
            scope = urlparse(m["fullScopeUrl"])
            self.assertEqual(scope.netloc, m["host"], p.parent.name)
            self.assertTrue(m["startUrl"].startswith(scope.path), f"{p.parent.name}: start {m['startUrl']} is outside scope {scope.path}")
            self.assertIn(m["startUrl"].strip("/").split("/")[0], m["packageId"] + m["webManifestUrl"], p.parent.name)   # /rider/ goes with in.goserve.rider


if __name__ == "__main__":
    unittest.main()
