#!/usr/bin/env python3
"""Build the static portal, including the lazy weather and games routes.

The default build references versioned local CSS/JS for independent browser caching.
Use --inline for the former bundled HTML (weather and artwork remain local assets).
"""
from pathlib import Path
import argparse
import hashlib
import posixpath
import re
import shutil

ROOT = Path(__file__).resolve().parent
CSS = ['style.css', 'tools.css', 'tools-page.css', 'creative.css', 'data.css', 'neural-terminal.css', 'splash.css', 'showcase.css', 'search-page.css', '../tools/city.css', '../tools/approved.css', '../tools/approved-responsive.css', '../markets/style.css']
JS = ['core.js', 'tools.js', 'creative.js', 'data.js', 'neural-terminal-route.js', 'pages.js',
      'search-page.js', 'home-data.js', 'splash.js', 'showcase.js', '../weather/model.js', 'weather-route.js', 'games-route.js', 'family-route.js', 'health-route.js', 'oberon-route.js', 'mpp-route.js', '../tools/loan-model.js', '../tools/science-model.js', '../tools/common.js', '../tools/loan-view.js', '../tools/science-view.js', '../tools/approved-workspace.js', 'corporate-tools.js', '../markets/model.js', '../markets/chart.js', '../markets/view.js', 'boot.js']


def build(destination: Path, inline: bool = False):
    destination = destination.resolve()
    template = (ROOT / 'template.html').read_text(encoding='utf-8')
    if inline:
        styles = '\n'.join('/* '+name+' */\n'+(ROOT/name).read_text(encoding='utf-8') for name in CSS)
        styles = re.sub(r'@charset\s+[^;]+;', '', styles)
        scripts = '\n'.join('\n/* '+name+' */\n'+(ROOT/name).read_text(encoding='utf-8') for name in JS)
        scripts = re.sub(r'</script', r'<\\/script', scripts, flags=re.I)
        html = template.replace('/*__STYLES__*/', styles).replace('/*__SCRIPTS__*/', scripts)
    else:
        def url(name):
            digest = hashlib.sha256((ROOT/name).read_text(encoding='utf-8').encode('utf-8')).hexdigest()[:12]
            return f'{posixpath.normpath("src/"+name)}?v={digest}' 
        styles = '\n  '.join(f'<link rel="stylesheet" href="{url(name)}">' for name in CSS)
        scripts = '\n  '.join(f'<script src="{url(name)}" defer></script>' for name in JS)
        html = template.replace('<style>/*__STYLES__*/</style>', styles)
        html = html.replace('<script>/*__SCRIPTS__*/</script>', scripts)
    if '/*__STYLES__*/' in html or '/*__SCRIPTS__*/' in html:
        raise ValueError('Template markers were not replaced')
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(html, encoding='utf-8', newline='\n')
    # Every output, including dist/, is a complete static site, not a broken HTML copy.
    for name in ('assets', 'weather', 'tools', 'markets', 'games', 'family', 'health', 'oberon', 'help', 'mpp', 'terminal') + (() if inline else ('src',)):
        source, target = ROOT.parent/name, destination.parent/name
        if source.is_dir() and (source.resolve() != target.resolve()):
            shutil.copytree(source, target, dirs_exist_ok=True,
                            ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
    (destination.parent/'.nojekyll').touch()
    print(f'Built {destination} ({len(html.encode("utf-8")):,} bytes, inline={inline})')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', nargs='?', default=str(ROOT.parent/'index.html'))
    parser.add_argument('--inline', action='store_true', help='Embed core CSS/JS as before')
    args = parser.parse_args()
    build(Path(args.output), inline=args.inline)
