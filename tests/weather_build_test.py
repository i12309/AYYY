"""Packaging checks: both local-resource and inline builds remain portable."""
import hashlib
import importlib.util
import posixpath
from pathlib import Path
import re
import subprocess
import tempfile
import unittest
from urllib.parse import urlsplit, unquote

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('ayyy_build',ROOT/'src/build.py')
build=importlib.util.module_from_spec(spec);spec.loader.exec_module(build)

class StaticBuild(unittest.TestCase):
    def test_route_order(self):
        self.assertLess(build.JS.index('data.js'),build.JS.index('weather-route.js'))
        self.assertLess(build.JS.index('../weather/model.js'),build.JS.index('weather-route.js'))
        self.assertLess(build.JS.index('weather-route.js'),build.JS.index('boot.js'))
    def test_versioned_local_resources(self):
        with tempfile.TemporaryDirectory() as tmp:
            out=Path(tmp)/'index.html';build.build(out)
            html=out.read_text();self.assertNotIn('/*__SCRIPTS__*/',html)
            for name in build.CSS+build.JS:
                digest=hashlib.sha256((ROOT/'src'/name).read_text(encoding='utf-8').encode('utf-8')).hexdigest()[:12]
                self.assertIn(posixpath.normpath('src/'+name)+'?v='+digest,html)
                self.assertTrue((out.parent/'src'/name).is_file())
    def test_weather_assets_in_distribution(self):
        with tempfile.TemporaryDirectory() as tmp:
            out=Path(tmp)/'index.html';build.build(out)
            for name in ('index.html','model.js','scene.js','view.js','style.css','seamless.css','landscape.css','scene-controls.css','scene-panel.css','mobile-compact.css','tree.css','scene-state.js','scene-controller.js','viewport-fit.js','viewport-fit.css','tree-palette.js','tree-scene.js','assets/tree/tree-structure.png','coast.svg','assets/lighthouse.avif'):
                self.assertEqual((out.parent/'weather'/name).read_bytes(),(ROOT/'weather'/name).read_bytes())
            self.assertTrue((out.parent/'.nojekyll').exists())
    def test_inline_still_supported(self):
        with tempfile.TemporaryDirectory() as tmp:
            out=Path(tmp)/'index.html';build.build(out,inline=True)
            html=out.read_text();self.assertIn('/* weather-route.js */',html)
            self.assertNotIn('/*__STYLES__*/',html)
            code=html.split('<script>',1)[1].rsplit('</script>',1)[0]
            js=Path(tmp)/'bundle.js';js.write_text(code)
            subprocess.run(['node','--check',str(js)],check=True,capture_output=True)
            self.assertTrue((Path(tmp)/'weather/coast.svg').exists())
    def test_spaces_in_output_path(self):
        with tempfile.TemporaryDirectory() as tmp:
            out=Path(tmp)/'a directory with spaces'/'index.html';build.build(out)
            for href in re.findall(r'(?:src|href)="([^"]+)"',out.read_text()):
                u=urlsplit(href)
                if u.scheme or not u.path:continue
                self.assertTrue((out.parent/unquote(u.path)).exists(),href)
    def test_corporate_assets_in_distribution(self):
        with tempfile.TemporaryDirectory() as tmp:
            out=Path(tmp)/'index.html';build.build(out)
            for name in ('loan-model.js','science-model.js','common.js','loan-view.js','science-view.js','city.css','assets/city.avif'):
                self.assertEqual((out.parent/'tools'/name).read_bytes(),(ROOT/'tools'/name).read_bytes())
            self.assertNotIn('src/../',out.read_text())
    def test_corporate_order(self):
        self.assertLess(build.JS.index('tools.js'),build.JS.index('corporate-tools.js'))
        self.assertLess(build.JS.index('../tools/loan-model.js'),build.JS.index('../tools/loan-view.js'))
        self.assertLess(build.JS.index('../tools/science-model.js'),build.JS.index('../tools/science-view.js'))
        self.assertLess(build.JS.index('corporate-tools.js'),build.JS.index('boot.js'))
    def test_deterministic(self):
        with tempfile.TemporaryDirectory() as tmp:
            out=Path(tmp)/'index.html';build.build(out);one=out.read_bytes()
            build.build(out);self.assertEqual(one,out.read_bytes())
            self.assertEqual(one,(ROOT/'index.html').read_bytes())

if __name__=='__main__':unittest.main()
