"""Story #691 (radar, 29 Oct 2026): the prod build makes no tile call. Only the dev deploy carries a tile address.
Run: python3 scripts/test_map_tiles.py"""
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WF = ROOT / ".github" / "workflows"


class MapTiles(unittest.TestCase):
    def test_the_prod_deploy_has_no_tile_address(self):
        self.assertNotIn("VITE_MAP_TILES", (WF / "deploy-app.yml").read_text())

    def test_the_dev_deploy_uses_a_template_with_the_three_parts(self):
        text = (WF / "deploy-dev.yml").read_text()
        line = next(l for l in text.splitlines() if "VITE_MAP_TILES:" in l)
        for part in ("{z}", "{x}", "{y}"):
            self.assertIn(part, line)

    def test_nothing_else_in_the_app_names_a_tile_host(self):
        for p in (ROOT / "app" / "src").rglob("*.ts*"):
            self.assertNotIn("tile.openstreetmap.org", p.read_text(), str(p))


if __name__ == "__main__":
    unittest.main()
