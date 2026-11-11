#!/usr/bin/env python3
"""Refresh local asset versions after editing OBERON (no bundler required)."""
from hashlib import sha256
from pathlib import Path
import re

root = Path(__file__).resolve().parent
page = root / "index.html"

def version(match):
    prefix, name, suffix = match.groups()
    fingerprint = sha256((root / name).read_bytes()).hexdigest()[:12]
    return f'{prefix}{name}?v={fingerprint}{suffix}'

source = page.read_text(encoding="utf-8")
updated = re.sub(r'((?:src|href)=")([a-z][a-z0-9-]*\.(?:js|css))(?:\?v=[a-z0-9-]+)?(")', version, source)
if source != updated:
    page.write_text(updated, encoding="utf-8")
route = root.parent / "src" / "oberon-route.js"
if route.exists():
    fingerprint = sha256(updated.encode("utf-8")).hexdigest()[:12]
    original = route.read_text(encoding="utf-8")
    versioned = re.sub(r"const version='[^']+';", f"const version='oberon-{fingerprint}';", original)
    if original != versioned:
        route.write_text(versioned, encoding="utf-8")
print("OBERON asset versions refreshed.")
