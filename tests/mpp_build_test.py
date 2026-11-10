"""Build-level regression test for the standalone browser MPP viewer."""
from pathlib import Path
import tempfile
import unittest
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from src.build import build


class MppBuildTests(unittest.TestCase):
    def test_static_build_keeps_the_reader_and_links(self):
        with tempfile.TemporaryDirectory(prefix="ayyy-mpp-") as tmp:
            destination = Path(tmp) / "index.html"
            build(destination)
            page = destination.read_text(encoding="utf-8")
            self.assertIn("src/mpp-route.js?v=", page)
            self.assertIn('href="#mpp"', page)
            for relative in (
                "src/mpp-route.js",
                "mpp/viewer.mjs",
                "mpp/export-svg.mjs",
                "mpp/reader-worker.mjs",
                "mpp/model.mjs",
                "mpp/style.css",
                "mpp/vendor/mpxj-ts/mpxj.mjs",
                "mpp/vendor/mpxj-ts/LICENSE",
                "mpp/vendor/mpxj-ts/src/mpp14.ts",
            ):
                self.assertTrue((Path(tmp) / relative).is_file(), relative)


if __name__ == "__main__":
    unittest.main()
