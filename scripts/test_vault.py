"""Story (vault, owner 29 Oct 2026): every GoServe key lives in ~/Desktop/Secrets/goserve/goserve.env. The readers look there first, then in the old shared file.
Run: python3 -m unittest scripts/test_vault.py   (uses a temporary HOME; reads no real secret)"""
import os, sys, tempfile, unittest
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


class Vault(unittest.TestCase):
    def setUp(self):
        self.home = tempfile.TemporaryDirectory()
        self.old = os.environ.get("HOME")
        os.environ["HOME"] = self.home.name
        self.sec = Path(self.home.name) / "Desktop" / "Secrets"
        (self.sec / "goserve").mkdir(parents=True)
        import importlib, vault
        self.vault = importlib.reload(vault)

    def tearDown(self):
        os.environ["HOME"] = self.old
        self.home.cleanup()

    def test_a_key_in_the_goserve_file_wins_over_the_old_file(self):
        (self.sec / "goserve" / "goserve.env").write_text("KEY=new\n")
        (self.sec / "02_databases.env").write_text("KEY=old\n")
        self.assertEqual(self.vault.get("KEY", "02_databases.env"), "new")

    def test_a_key_only_in_the_old_file_is_still_found(self):
        (self.sec / "goserve" / "goserve.env").write_text("OTHER=1\n")
        (self.sec / "02_databases.env").write_text("KEY=old\n")
        self.assertEqual(self.vault.get("KEY", "02_databases.env"), "old")

    def test_without_the_goserve_file_the_old_file_is_used(self):
        (self.sec / "04_integrations.env").write_text("KEY=old\n")
        self.assertEqual(self.vault.get("KEY", "04_integrations.env"), "old")

    def test_a_key_that_is_nowhere_is_none_and_a_missing_old_file_is_not_an_error(self):
        self.assertIsNone(self.vault.get("NOPE", "02_databases.env"))

    def test_read_gives_the_goserve_text_first_so_a_regex_finds_the_new_value_first(self):
        import re
        (self.sec / "goserve" / "goserve.env").write_text("KEY=new\n")
        (self.sec / "02_databases.env").write_text("KEY=old\n")
        self.assertEqual(re.search(r"^KEY=(\S+)", self.vault.read("02_databases.env"), re.M).group(1), "new")

    def test_a_comment_line_is_not_a_key(self):
        (self.sec / "goserve" / "goserve.env").write_text("# KEY=commented\nKEY=real\n")
        self.assertEqual(self.vault.get("KEY", "02_databases.env"), "real")

    def test_the_prod_scripts_read_the_vault_when_the_shell_has_no_keys(self):   # story: prod_backend_v2.py failed with KeyError once the keys left the shared files
        (self.sec / "goserve" / "goserve.env").write_text("SUPABASE_GOSERVE_PROD_URL=https://prodprodprodprodprod.supabase.co\nSUPABASE_GOSERVE_PROD_ANON_KEY=anon-from-vault\n")
        (self.sec / "02_databases.env").write_text("SUPABASE_ACCESS_TOKEN=token-from-vault\n")
        import importlib, release_db, prod_backend_v2
        importlib.reload(release_db); importlib.reload(prod_backend_v2)
        class Stop(Exception): pass
        seen = []
        def stop(url): seen.append(url); raise Stop()
        for mod in (release_db, prod_backend_v2):
            target = prod_backend_v2.release_db if mod is prod_backend_v2 else release_db
            orig, target.ref_from_url = target.ref_from_url, stop
            try:
                with self.assertRaises(Stop):
                    mod.main([], {})   # an empty environment: the vault supplies the address
            finally:
                target.ref_from_url = orig
        self.assertEqual(seen, ["https://prodprodprodprodprod.supabase.co"] * 2)

    def test_a_key_in_the_environment_overrides_the_vault(self):
        (self.sec / "goserve" / "goserve.env").write_text("KEY=file\n")
        self.assertEqual(self.vault.setting({"KEY": "env"}, "KEY", "02_databases.env"), "env")
        self.assertEqual(self.vault.setting({}, "KEY", "02_databases.env"), "file")
        with self.assertRaises(KeyError):
            self.vault.setting({}, "NOPE", "02_databases.env")


if __name__ == "__main__":
    unittest.main()
