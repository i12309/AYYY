'use strict';
// Pixel contracts for the renderer's background preparation, using Node APIs only.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../weather/tree-scene.js'), 'utf8');
const helper = source.match(/function prepareSceneBackgrounds[\s\S]*?\n}\n/)[0];
const prepare = vm.runInNewContext(`(${helper})`);

function raster(width, height, pixel) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(pixel(x, y), (y * width + x) * 4);
  return { width, height, data };
}
function canvas(width, height) {
  const result = { width, height, data: new Uint8ClampedArray(width * height * 4) };
  result.getContext = () => ({
    drawImage: image => { result.data.set(image.data); },
    getImageData: () => ({ data: result.data.slice() }),
    putImageData: pixels => { result.data.set(pixels.data); }
  });
  return result;
}
const rgba = (image, x, y) => [...image.data.slice((y * image.width + x) * 4, (y * image.width + x) * 4 + 4)];
function assets(landscape) {
  const cloud = raster(1200, 360, (x, y) => [180, 190, 205, y > 350 ? 0 : 40 + x * 190 / 1199]);
  return { 'terrain.png': landscape, 'mountains.png': landscape, 'cloud-field-0.png': cloud, 'cloud-field-1.png': cloud, 'cloud-field-2.png': cloud };
}

test('baked panorama joins are continuous without changing the central illustration', () => {
  const input = raster(1672, 4, (x, y) => [40 + (x >= 150 ? 40 : 0) + (x >= 1300 ? 70 : 0), 110 + y, 150, 90 + (x >= 1300 ? 75 : 0)]);
  const original = input.data.slice();
  const output = prepare(assets(input), canvas);
  for (const layer of [output.terrain, output.mountains]) {
    for (const join of [150, 1300]) for (let y = 0; y < 4; y++) {
      const left = rgba(layer, join - 1, y), right = rgba(layer, join, y);
      assert.ok(Math.max(...left.map((value, channel) => Math.abs(value - right[channel]))) <= 2, `continuous source join at ${join}`);
    }
    for (let y = 0; y < 4; y++) for (let x = 200; x < 1200; x++) assert.deepEqual(rgba(layer, x, y), rgba(input, x, y));
  }
  assert.deepEqual(input.data, original, 'preparation must not mutate the approved source');
});

test('transparent panorama edges blend in premultiplied colour without a matte halo', () => {
  const input = raster(1672, 1, x => x < 1300 ? [255, 0, 0, 0] : [50, 150, 200, 128]);
  const output = prepare(assets(input), canvas).terrain;
  for (const x of [1299, 1300]) {
    const pixel = rgba(output, x, 0);
    assert.deepEqual(pixel.slice(0, 3), [50, 150, 200], 'invisible red matte must not bleed into visible colour');
    assert.ok(pixel[3] > 60 && pixel[3] < 68);
  }
});

test('every advected cloud has a feathered top and equal repeating alpha edges', () => {
  const input = assets(raster(1672, 1, () => [80, 90, 100, 128]));
  for (const cloud of prepare(input, canvas).clouds) {
    for (let x = 0; x < cloud.width; x++) assert.equal(rgba(cloud, x, 0)[3], 0, 'no horizontal rectangle at any vertical placement');
    for (let y = 0; y < cloud.height; y++) assert.equal(rgba(cloud, 0, y)[3], rgba(cloud, cloud.width - 1, y)[3], 'no seam as the field moves horizontally');
    assert.equal(rgba(cloud, 600, 100)[3], rgba(input['cloud-field-0.png'], 600, 100)[3], 'cloud interior remains unchanged');
    assert.equal(rgba(cloud, 600, 359)[3], 0, 'transparent cloud bottom stays transparent');
  }
});
