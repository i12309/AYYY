/* Shared AYYY GitHub help is an offline-capable static page. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');

test('single GitHub tutorial is available without JavaScript or external image dependencies',()=>{
  const html=read('help/github/index.html'),css=read('help/github/guide.css');
  assert.match(html,/<html lang="ru">/);
  assert.match(html,/href="guide\.css"/);
  assert.doesNotMatch(html,/<script\b/i);
  assert.equal((html.match(/class="step" id="step\d"/g)||[]).length,5);
  assert.equal((html.match(/mock-figure/g)||[]).length,5);
  assert.match(css,/@media\(max-width:500px\)/);
  assert.match(html, /Only select repositories/);
  assert.match(html, /Contents/);
  assert.match(html, /Read and write/);
  assert.match(html, /Metadata/);
  assert.match(html, /Generate token/);
  assert.match(html, /https:\/\/github\.com\/settings\/personal-access-tokens\/new/);
});

test('guide explains module-specific data and acknowledges repository-wide PAT access',()=>{
  const html=read('help/github/index.html');
  for(const path of ['OBERON/','family-data/trees/','health-data/v2/'])assert.ok(html.includes(path));
  assert.match(html,/всём выбранном репозитории/);
  assert.match(html,/HUMAN.*шифрует|HUMAN.*шифрованием/s);
  assert.match(html,/Private/);
  assert.match(html,/резервные копии/);
});

test('standalone build copies shared GitHub help directory to distribution',()=>{
  assert.match(read('src/build.py'),/'help'/);
});
