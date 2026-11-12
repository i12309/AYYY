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

## V2: no rectangular backing (2026-11-12)

The final renders live under `assets/service-art/v2/` and supersede the `v1` crops.
They are generated from individually composed transparent illustrations rather
than from the rounded presentation-board panels. All ten heroes and ten card
previews are RGBA WebP with nonopaque, organically shaped edges, and the gallery
has no added image border-radius. Card previews are focused soft-edge crops of
the same illustrations; the card itself retains its accessible link, title and
status. The default lighthouse is preserved. The existing v1 files remain as an
archive, but are not referenced at runtime.

The `v2/manifest.json` records each image's SHA-256, dimensions and alpha
coverage. Browser regression checks first-pixel transparency on each hero.

## Card preview restoration (2026-11-12)

The left-side service illustration remains the **transparent, borderless v2 hero**.
The small preview inside every right-hand service row has been restored to the
**original v1 card crop**, fully covering its left image area. In particular,
OBERON shows the dark note rocket, Health shows the split H on a solid dark
background, Weather shows the square thunderstorm scene, and the other seven
services retain their original card art. The earlier v2 card crops remain
archived but are no longer referenced. No service routes, descriptions,
GitHub connections, the lighthouse default, or hover logic were changed.
