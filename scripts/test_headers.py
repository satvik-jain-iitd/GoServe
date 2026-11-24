# Security headers (#944): app/public/_headers exists, the CSP is Report-Only (never enforcing), and the plain headers are set.
# Plain text checks, no DB token needed. Run: python3 -m unittest scripts/test_headers.py
import os, re, unittest

P = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "app", "public", "_headers")


class Headers(unittest.TestCase):
    def setUp(self):
        self.assertTrue(os.path.exists(P), "app/public/_headers is missing")
        self.t = open(P).read()

    def test_csp_is_report_only(self):
        self.assertRegex(self.t, r"(?m)^\s+Content-Security-Policy-Report-Only: .*default-src 'self'")
        self.assertNotRegex(self.t, r"(?m)^\s+Content-Security-Policy:")

    def test_plain_headers(self):
        for h in ["X-Content-Type-Options: nosniff", "X-Frame-Options: DENY", "Referrer-Policy: strict-origin-when-cross-origin"]:
            self.assertIn(h, self.t)


if __name__ == "__main__":
    unittest.main()
