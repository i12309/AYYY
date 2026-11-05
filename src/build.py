#!/usr/bin/env python3
"""Assemble AYYY into one portable HTML document, with no dependencies."""
from pathlib import Path
import argparse
import re

ROOT = Path(__file__).resolve().parent
CSS = ['style.css', 'tools.css', 'creative.css', 'data.css', 'productivity.css']
JS = ['core.js', 'tools.js', 'creative.js', 'data.js', 'productivity.js', 'pages.js', 'connected.js', 'boot.js']

def build(destination: Path):
    template = (ROOT / 'template.html').read_text(encoding='utf-8')
    styles = '\n'.join('/* '+name+' */\n'+(ROOT / name).read_text(encoding='utf-8') for name in CSS)
    styles = re.sub(r'@charset\s+[^;]+;', '', styles)
    scripts = '\n'.join('\n/* '+name+' */\n'+(ROOT / name).read_text(encoding='utf-8') for name in JS)
    scripts = re.sub(r'</script', r'<\\/script', scripts, flags=re.I)
    html = template.replace('/*__STYLES__*/', styles).replace('/*__SCRIPTS__*/', scripts)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(html, encoding='utf-8')
    print(f'Built {destination} ({len(html.encode("utf-8")):,} bytes)')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', nargs='?', default=str(ROOT.parent / 'index.html'))
    args = parser.parse_args()
    build(Path(args.output).resolve())
