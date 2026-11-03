# Story #873: Supabase loads the `safeupdate` library on the PostgREST connection (role authenticator, session_preload_libraries = supautils, safeupdate),
# and it refuses every DELETE or UPDATE without a WHERE clause there: "DELETE requires a WHERE clause (21000)". The owner's Clear everything hit it.
# A management-API session cannot load that library ("access to library safeupdate is not allowed") and a call through PostgREST would really wipe dev,
# so this test reads the SQL instead: in the latest definition of a function the admin app calls, every DELETE and UPDATE has a WHERE.
# Add a function name to CALLED_BY_THE_APP when a new admin or staff function writes rows. No token needed; it runs in CI.
# Run: python3 -m unittest scripts/test_safeupdate.py
import glob, os, re, unittest

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
CALLED_BY_THE_APP = ["sim_clear_all", "kitchen_remove_v2"]


def latest_body(name):
    """The text between the dollar quotes of the last migration (by file name) that creates the function."""
    found = None
    for f in sorted(glob.glob(os.path.join(ROOT, "supabase", "migrations", "*.sql")) + glob.glob(os.path.join(ROOT, "app", "supabase", "migrations", "*.sql"))):
        sql = re.sub(r"--[^\n]*", "", open(f).read())
        m = re.search(r"create\s+(?:or\s+replace\s+)?function\s+%s\s*\(.*?\$\$(.*?)\$\$" % re.escape(name), sql, re.I | re.S)
        if m:
            found = (os.path.basename(f), m.group(1))
    return found


def statements(body):
    return [s.strip() for s in body.split(";") if re.match(r"\s*(delete\s+from|update\b)", s, re.I) or re.search(r"\(\s*(delete\s+from|update\b)", s, re.I)]


class Safeupdate(unittest.TestCase):
    def test_every_delete_and_update_of_the_functions_the_app_calls_has_a_where(self):
        for name in CALLED_BY_THE_APP:
            f = latest_body(name)
            self.assertIsNotNone(f, name)
            for s in statements(f[1]):
                self.assertRegex(s, r"\bwhere\b", f"{name} ({f[0]}): refused by safeupdate on PostgREST: {' '.join(s.split())[:90]}")


if __name__ == "__main__":
    unittest.main()
