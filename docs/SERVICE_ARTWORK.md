# Service artwork integration

The directory now uses the ten approved artwork boards from 2026-11-11. Each board
was cropped into two **different** images: a large left-hand scene (`*-hero.webp`)
and a square 480 × 480 card illustration (`*-card.webp`). Presentation-sheet
headings, divider lines, and the small inset are excluded from the hero images.

Files are local to `assets/service-art/v1/`. No external image hosting, signed
URLs, API requests, or image-generation dependency is used at runtime. The
manifest records source checksums, crop rectangles, dimensions, sizes and SHA-256
checksums of all twenty outputs. Original full-resolution PNG boards are not
included in the website download.

## Order and subjects

1. OBERON — orbital mark; paper-note rocket in its dark card.
2. Health — detailed DNA; split H card.
3. Weather — watercolor tree and storm; thundercloud card.
4. Family — historical family tree; family-tree emblem card.
5. Games — game-world scene; controller and puzzle card.
6. Finance — gold, silver and banknotes; candlestick chart card.
7. Tools — financial skyscraper; drawing instruments card.
8. Project Viewer — project-planning scene; Gantt preview card.
9. Smart Search — document/map search; magnifying-glass card.
10. Terminal — green CRT scene; phosphor-green command card.

`src/core.js` is the canonical service order. IDs, routes, favorites and saved
homepage selections retain their identities. The default lighthouse is unchanged.
Hover and keyboard focus select the matching hero; leaving the card restores the
lighthouse. The full-width grid and constrained sticky left column remain intact.

## Checks

```sh
python3 src/build.py
node --test tests/service_showcase.test.cjs tests/retired_services.test.cjs tests/oberon_portal.test.cjs
CHROME_BIN=/usr/bin/chromium python3 tests/service_artwork_browser.py
```

The browser regression loads the full portal with its production styles/scripts.
It checks all twenty image files, service order, ten viewport sizes (320–1920 px),
hover/focus, lighthouse reset, filtering, favorites, and details. In environments
that prohibit localhost navigation, `AYYY_EMBEDDED_RENDER=1` renders that same
HTML using `set_content`; only unavailable origin storage is mocked, so that mode
is a layout/interaction check, not a GitHub-sync or persistence test.
