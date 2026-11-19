"""Story 1634: the App job in CI must keep at least 30 minutes.

The App job ran 18 min 5 s on run 44452802471 and was cancelled by its old
20-minute limit on run 44450204797. This test reads ci.yml as plain text.
No network, no YAML library.
"""
import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
CI = ROOT / ".github" / "workflows" / "ci.yml"


class CiLimits(unittest.TestCase):
    def test_app_job_has_at_least_30_minutes(self):
        text = CI.read_text(encoding="utf-8")
        job = re.search(r"^  app:\n(.*?)(?=^  \S|\Z)", text, re.S | re.M)
        self.assertIsNotNone(job, "no `app:` job block in ci.yml")
        limit = re.search(r"timeout-minutes:\s*(\d+)", job.group(1))
        self.assertIsNotNone(limit, "the app job has no timeout-minutes")
        self.assertGreaterEqual(int(limit.group(1)), 30)


if __name__ == "__main__":
    unittest.main()
