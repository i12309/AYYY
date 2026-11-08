'use strict';
// Built-in Node APIs only: the approved prototype is the expected result.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const reference = fs.readFileSync(path.join(root, 'prototypes/weather-tree-v5/reference.html'), 'utf8');
const scripts = [...reference.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]);
const renderer = fs.readFileSync(path.join(root, 'weather/tree-scene.js'), 'utf8');
const rect = (x, y, width, height) => ({ x, y, left: x, top: y, width, height, bottom: y + height });
const element = bounds => ({ getBoundingClientRect: () => bounds });

function makeScene(source, fixture, offset = { x: 0, y: 0, scroll: 0 }) {
  const uiScale = fixture.uiScale || 1;
  const hourly = fixture.anchors['.hourly'];
  const pageHeight = fixture.pageHeight ?? Math.max(fixture.height, hourly[1] + hourly[3] + 90);
  const anchors = { ...fixture.anchors, '.page': [0, 0, fixture.width, pageHeight] };
  const nodes = Object.fromEntries(Object.entries(anchors).map(([name, values]) => {
    const [x, y, width, height] = values;
    return [name, element(rect(x + offset.x, y + offset.y - offset.scroll, width, height))];
  }));
  const images = ['spring', 'summer', 'autumn', 'winter'].map(treePreview => ({ dataset: { treePreview } }));
  const document = {
    documentElement: { clientWidth: fixture.width },
    querySelector: name => nodes[name],
    querySelectorAll: () => images,
    // A symbolic canvas checks the preview API without a native canvas dependency.
    createElement: () => {
      const canvas = { getContext: () => ({ drawImage: source => { canvas.source = source; } }) };
      canvas.toDataURL = () => 'data:image/png;base64,' + Buffer.from(JSON.stringify([canvas.width, canvas.height, canvas.source])).toString('base64');
      return canvas;
    }
  };
  const sandbox = { document, innerHeight: fixture.height, scrollY: offset.scroll, AYYYSceneModel: {}, AYYYTreePalette: {} };
  sandbox.window = sandbox;
  vm.runInNewContext(source, sandbox);
  const Type = sandbox.AYYYTreeScene || sandbox.AYYYAtmosphere;
  const scene = Object.create(Type.prototype);
  const aliases = { '.ww-center': '.center-spacer', '.ww-scene-anchor': '.scene-controls', '.ww-scene-controls': '.scene-controls', '.ww-hourly': '.hourly', '.ww-page': '.page' };
  scene.layout = {
    clientWidth: fixture.width,
    style: { getPropertyValue: name => name === '--ww-ui-scale' ? String(uiScale) : '' },
    querySelector: name => name === '.ww-viewport' ? { clientWidth: fixture.width / uiScale } : nodes[aliases[name]],
    querySelectorAll: () => images
  };
  scene.host = { ...element(rect(offset.x, offset.y - offset.scroll, fixture.width, fixture.height)), clientWidth: fixture.width };
  return { scene, images };
}

const fixtures = [
  // Height limits the scale here: the former +50 desktop inset must fail.
  { width: 1440, height: 1000, anchors: { '.center-spacer': [350, 300, 650, 500], '.scene-controls': [400, 100, 800, 160], '.hourly': [50, 850, 1340, 170] } },
  { width: 980, height: 1000, anchors: { '.center-spacer': [40, 320, 900, 420], '.scene-controls': [40, 160, 900, 140], '.hourly': [40, 1100, 900, 170] } },
  { width: 390, height: 844, anchors: { '.center-spacer': [17, 310, 356, 360], '.scene-controls': [17, 150, 356, 140], '.hourly': [17, 1700, 356, 170] } }
];
const plain = value => JSON.parse(JSON.stringify(value));

test('tree geometry matches v5 at each breakpoint, including embedded and scrolled apps', () => {
  for (const fixture of fixtures) {
    const expected = plain(makeScene(scripts[2], fixture).scene.geometry());
    for (const offset of [{ x: 0, y: 0, scroll: 0 }, { x: 80, y: 140, scroll: 245 }]) {
      const { uiScale, ...actual } = plain(makeScene(renderer, fixture, offset).scene.geometry());
      assert.equal(uiScale, 1, 'unscaled geometry metadata');
      assert.deepEqual(actual, expected, `${fixture.width}px, offset ${JSON.stringify(offset)}`);
    }
  }
});

test('tree geometry scales proportionally with the UI, including a desktop narrower than 1100px after zoom', () => {
  const fixture = fixtures[0];
  const expected = plain(makeScene(scripts[2], fixture).scene.geometry());
  for (const uiScale of [.5, .75, 1.25, 2]) {
    const scaled = {
      width: fixture.width * uiScale,
      height: fixture.height * uiScale,
      pageHeight: expected.h * uiScale,
      uiScale,
      anchors: Object.fromEntries(Object.entries(fixture.anchors).map(([name, values]) => [name, values.map(value => value * uiScale)]))
    };
    for (const offset of [{ x: 0, y: 0, scroll: 0 }, { x: 80, y: 140, scroll: 245 }]) {
      const actual = plain(makeScene(renderer, scaled, offset).scene.geometry());
      assert.equal(actual.uiScale, uiScale, 'shared scale for all scene layers');
      for (const [key, value] of Object.entries(expected)) {
        if (typeof value === 'number') assert.ok(Math.abs(actual[key] - value * uiScale) < 1e-9, `${key} at ${uiScale} scale`);
        else assert.equal(actual[key], value, `${key} at ${uiScale} scale`);
      }
    }
  }
});

test('opening and closing the settings panel never changes the illustration anchor', () => {
  for (const fixture of fixtures) {
    const { scene } = makeScene(renderer, fixture);
    const expected = plain(scene.geometry()), query = scene.layout.querySelector;
    for (const panel of [rect(0, 0, 0, 0), rect(320, 72, 600, 360)]) {
      scene.layout.querySelector = name => name === '.ww-scene-controls' ? element(panel) : query(name);
      assert.deepEqual(plain(scene.geometry()), expected, 'tree must use its independent anchor, not the popup rectangle');
    }
  }
});

test('canvas height follows the complete page without adding artificial scrolling below a fitted footer', () => {
  const fixture = { ...fixtures[0], height: 900, pageHeight: 890,
    anchors: { ...fixtures[0].anchors, '.hourly': [50, 730, 1340, 150] } };
  assert.equal(makeScene(renderer, fixture).scene.geometry().h, 900, 'fitted page fills the viewport exactly');
  assert.equal(makeScene(renderer, { ...fixture, pageHeight: 1160 }).scene.geometry().h, 1160, 'scrolling page includes its actual footer');
});

test('the approved connected-tree helper and all 11 PNG assets stay unchanged', () => {
  const helper = source => source.match(/function prepareTreeArtwork[\s\S]*?\n}\n/)[0];
  assert.equal(helper(renderer), helper(scripts[2]));
  const assets = JSON.parse(scripts[0].slice(scripts[0].indexOf('=') + 1).trim().replace(/;$/, ''));
  assert.equal(Object.keys(assets).length, 11);
  for (const [name, uri] of Object.entries(assets)) {
    assert.ok(fs.readFileSync(path.join(root, 'weather/assets/tree', name)).equals(Buffer.from(uri.split(',')[1], 'base64')), name);
  }
});

test('season previews follow v5, are cached, and do not add snow to live conditions', () => {
  const reference = makeScene(scripts[2], fixtures[0]);
  const actual = makeScene(renderer, fixtures[0]);
  const composition = (month, snowCover = true) => ({ month, snow: [0, 1, 11].includes(month) && snowCover });
  reference.scene.composeTree = composition;
  reference.scene.renderTreePreviews();
  assert.equal(actual.scene.preview('winter'), null, 'not ready yet');
  actual.scene.ready = true;
  actual.scene.params = { snowCover: false };
  let compositions = 0;
  actual.scene.composeTree = (month, snowCover = actual.scene.params.snowCover) => { compositions++; return composition(month, snowCover); };
  for (const image of reference.images) {
    const season = image.dataset.treePreview;
    assert.equal(actual.scene.preview(season), image.src, season);
    assert.equal(actual.scene.preview(season), image.src, `${season} cached`);
  }
  assert.equal(compositions, 4);
  assert.equal(actual.scene.params.snowCover, false);
  assert.equal(actual.scene.preview('invalid'), null);
});
