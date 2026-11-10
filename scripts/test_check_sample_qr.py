# Stories #1262 and #1263: the prod gate that fails when the prod build allows the sample QR.
import pathlib, tempfile, unittest
from check_sample_qr import sample_in_prod

class SampleQr(unittest.TestCase):
    def test_the_flag_in_the_prod_workflow_is_a_hit_and_its_absence_is_clean(self):
        with tempfile.TemporaryDirectory() as d:
            root = pathlib.Path(d); (root / ".github/workflows").mkdir(parents=True)
            self.assertEqual(sample_in_prod(root), [])
            f = root / ".github/workflows/deploy-app.yml"
            f.write_text("env:\n  VITE_OFFERS: 1\n")
            self.assertEqual(sample_in_prod(root), [])
            f.write_text("env:\n  VITE_SAMPLE_QR: 1\n")
            self.assertEqual(sample_in_prod(root), [".github/workflows/deploy-app.yml"])

if __name__ == "__main__":
    unittest.main()
