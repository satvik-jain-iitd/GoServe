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

    def test_the_manifest_is_applied_before_the_build_with_no_terminal(self):
        # The version step and the keystore step rewrite twa-manifest.json; without `update` Bubblewrap asks a question and keeps the old versionCode.
        u = self.t.index("bubblewrap update --skipVersionUpgrade < /dev/null")
        b = self.t.index("bubblewrap build --skipPwaValidation < /dev/null")
        self.assertLess(u, b)

    def test_the_sdk_path_passes_bubblewrap_and_build_tools_are_installed(self):
        # Bubblewrap 1.27 wants <sdk>/tools or <sdk>/bin; the runner has only cmdline-tools/latest/bin. Run 40175699981 failed on it.
        self.assertRegex(self.t, r'ln -sfn "\$ANDROID_HOME/cmdline-tools/latest/bin" "\$ANDROID_HOME/bin"')
        self.assertRegex(self.t, r'sdkmanager[^\n]*"build-tools;36\.1\.0"')
        self.assertLess(self.t.index('ln -sfn'), self.t.index("bubblewrap update"))

    def test_no_keystore_can_be_committed(self):
        g = (W.parent.parent.parent / ".gitignore").read_text()
        self.assertIn("ops/android/**/*.jks", g)
        self.assertIn("ops/android/**/*.keystore", g)


if __name__ == "__main__":
    unittest.main()
