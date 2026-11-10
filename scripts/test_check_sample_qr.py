# Story #1262: the prod gate that fails while the sample QR is the image.
import pathlib, tempfile, unittest
from check_sample_qr import sample_in_use

class SampleQr(unittest.TestCase):
    def test_the_sample_file_or_a_reference_to_it_is_a_hit_and_neither_is_clean(self):
        with tempfile.TemporaryDirectory() as d:
            root = pathlib.Path(d); (root / "app/public").mkdir(parents=True); (root / "app/src").mkdir(parents=True)
            self.assertEqual(sample_in_use(root), [])
            (root / "app/public/qr-sample.svg").write_text("<svg/>")
            self.assertEqual(sample_in_use(root), ["app/public/qr-sample.svg"])
            (root / "app/public/qr-sample.svg").unlink()
            (root / "app/src/A.tsx").write_text('<img src="qr-sample.svg" />')
            self.assertEqual(sample_in_use(root), ["app/src/A.tsx"])

if __name__ == "__main__":
    unittest.main()
