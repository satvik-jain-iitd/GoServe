"""Story #251: shape checks on .github/workflows/build-apk.yml. Run: python3 scripts/test_build_apk_workflow.py"""
import re, unittest
from pathlib import Path

W = Path(__file__).resolve().parent.parent / ".github/workflows/build-apk.yml"


class Workflow(unittest.TestCase):
    def setUp(self):
        self.t = W.read_text()

    def test_runs_on_a_published_release_and_by_hand(self):
        self.assertRegex(self.t, r"release:\s*\n\s*types:\s*\[published\]")
        self.assertIn("workflow_dispatch:", self.t)

    def test_the_keystore_comes_from_secrets_only(self):
        for s in ["ANDROID_KEYSTORE_B64", "ANDROID_KEYSTORE_PASSWORD", "ANDROID_KEY_PASSWORD"]:
            self.assertIn("${{ secrets.%s }}" % s, self.t)
        self.assertNotRegex(self.t, r"(?i)(password|keystore_b64)\s*[:=]\s*['\"]?[A-Za-z0-9+/=]{8,}['\"]?\s*$", "a literal secret in the file")
        self.assertNotIn("set -x", self.t)

    def test_the_version_comes_from_the_tag(self):
        self.assertIn("scripts/apk_version.py", self.t)
        self.assertIn("github.event.release.tag_name", self.t)

    def test_the_release_carries_the_apk_and_the_qr(self):
        self.assertIn("goserve-${VERSION}.apk", self.t)
        self.assertIn("goserve-qr.png", self.t)
        self.assertIn("gh release upload", self.t)

    def test_the_keystore_file_is_removed_and_permissions_are_minimal(self):
        self.assertRegex(self.t, r"rm -f .*\.jks")
        self.assertRegex(self.t, r"permissions:\s*\n\s*contents:\s*write")


if __name__ == "__main__":
    unittest.main()
