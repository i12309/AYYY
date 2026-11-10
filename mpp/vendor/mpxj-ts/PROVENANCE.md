# Vendored mpxj-ts Microsoft Project reader

This directory contains the independently replaceable mpxj-ts browser reader
and its corresponding TypeScript source code under the GNU LGPL 2.1 or later.

- Original project source: https://johnmcm.com/source/mpxj/
- Original source archived by: https://github.com/mja1337/ms-project-viewer
- Source snapshot: October 13–15, 2026, derived from MPXJ commit
  3f9244a9c49b052300c2500545cb5ea65340792b.
- Original MPXJ authors: Jon Iles and MPXJ contributors.
- License: LGPL-2.1-or-later; see LICENSE in this directory.
- Original compiled ES module: mja1337/ms-project-viewer,
  public/vendor/mpxj-ts/mpxj.mjs, blob 5eeae808329e1b527b4fbb62ee987d2c9b0c2b66.
- The original TypeScript sources in src/ and tools/ are copied unchanged.
- AYYY-specific build.mjs and package.json change the output location only.

The HTML/JS viewer imports mpxj.mjs at runtime. AYYY does not bundle or
modify that library; you can replace this file with your own build.

To rebuild (optional, not required to run AYYY):

1. In this directory run: npm install
2. Run: npm run build
3. Serve AYYY normally. The new mpxj.mjs is loaded on the next uncached visit.

The website itself requires no npm, Java, backend, or build step at runtime.
Modified versions of the LGPL reader must retain LGPL terms and make their
corresponding sources available.
