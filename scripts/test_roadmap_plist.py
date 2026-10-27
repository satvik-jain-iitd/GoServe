# Story #497 (E25): the repo copy of the roadmap LaunchAgent is the job the owner installed on 27 Oct: one roadmap, driven by the GitHub workflow.
import os, plistlib, unittest

PLIST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ops", "launchd", "com.goserve.roadmap.plist")
CMD = 'GH_TOKEN="$(gh auth token --user klickbae8yt-star)" gh workflow run roadmap.yml --repo satvik-jain-iitd/GoServe --ref main && date'


class RoadmapPlist(unittest.TestCase):
    def setUp(self):
        self.p = plistlib.load(open(PLIST, "rb"))

    def test_it_dispatches_the_one_workflow_with_the_dev_account_token(self):
        self.assertEqual(self.p["ProgramArguments"], ["/bin/sh", "-c", CMD])

    def test_every_900_seconds_from_tmp_and_no_old_local_roadmap(self):
        self.assertEqual((self.p["StartInterval"], self.p["WorkingDirectory"]), (900, "/tmp"))
        text = open(PLIST, encoding="utf-8").read()
        self.assertNotIn("scripts/roadmap.py", text.split("-->", 1)[1])
        self.assertNotIn("CLOUDFLARE_ROADMAP_TOKEN", text.split("-->", 1)[1])


if __name__ == "__main__":
    unittest.main()
