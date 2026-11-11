/* Node built-in regression tests for removed services.
 * Run from a checkout: node --test tests/retired_services.test.cjs
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const retired = ['mail', 'parcels', 'paint', 'notes', 'bookmarks', 'focus'];

function makePortal() {
  const storage = new Map(), opened = [];
  const window = {
    addEventListener() {},
    open(...args) { opened.push(args); }
  };
  const document = { addEventListener() {} };
  const localStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, value); }
  };
  const ctx = vm.createContext({
    window, document, localStorage, setInterval: () => 1,
    clearInterval() {}, setTimeout: () => 1, clearTimeout() {},
    crypto: { randomUUID: () => 'test-uuid' }, Date, Math
  });
  ['src/core.js', 'src/pages.js', 'src/creative.js',
    'src/neural-terminal-route.js', 'src/splash.js']
    .forEach(file => vm.runInContext(read(file), ctx, { filename: file }));
  return { app: window.AYYY, storage, opened };
}

test('only active services are registered; focus is retired and the AI demo remains', () => {
  const { app } = makePortal();
  assert.equal(app.services.length, 17);
  assert.ok(app.services.find(s => s.id === 'family'));
  assert.deepEqual(Array.from(app.services.filter(s=>s.group==='games'),s=>[s.id,s.name,s.route,s.param]),[['games','Игры','games',undefined]]);
  assert.equal(app.services.find(s=>s.id==='ai').name,'Терминал');
  assert.equal(app.services.find(s=>s.id==='health').desc,'Медкарта, анализы, графики');
  retired.forEach(id => {
    assert.equal(app.services.find(s => s.id === id), undefined, id);
    assert.equal(app.views[id], undefined, id);
  });
  ['home', 'directory', 'games', 'ai'].forEach(id =>
    assert.ok(app.views[id], id));
});

test('retired favorites and shortcuts are filtered without clearing local data', () => {
  const { app, storage } = makePortal();
  storage.set('ayyy:v1:favorites', JSON.stringify(['notes', 'weather', 'parcels', 'memory', '2048', 'games', 'calc']));
  assert.equal(Array.from(app.favorites()).join(','), 'weather,games,calc');
  assert.deepEqual(JSON.parse(storage.get('ayyy:v1:favorites')),
    ['notes', 'weather', 'parcels', 'memory', '2048', 'games', 'calc']);
  storage.set('ayyy:v1:home.shortcuts', JSON.stringify(['memory', '2048', 'math', 'ai']));
  const selected=app.views.home.render();
  assert.equal((selected.match(/href="#games"/g)||[]).length,1);
  assert.match(selected,/>Терминал<\/span>/);
  storage.set('ayyy:v1:home.shortcuts', JSON.stringify(['notes', 'parcels', 'paint']));
  const html = app.views.home.render();
  assert.doesNotMatch(html, /href="#focus"/);
  retired.forEach(id => assert.doesNotMatch(html, new RegExp('href="#'+id+'"')));
});

test('retired focus timer is absent; AI opens the neural terminal', () => {
  const { app } = makePortal();
  assert.equal(app.getTasks, undefined);
  assert.equal(app.mountTasks, undefined);
  assert.equal(app.views.focus, undefined);
  assert.match(app.views.ai.render(), /neural-terminal-frame/);
  assert.match(app.views.ai.render(), /terminal\/index\.html/);
  assert.match(app.views.games.render(), /games-catalog/);
});

test('web search still launches an encoded query', () => {
  const { app, opened } = makePortal();
  app.performSearch('проверка & поиск', 'web', 'Google', 'web');
  assert.equal(opened.length, 1);
  assert.match(opened[0][0], /^https:\/\/www\.google\.com\/search\?q=/);
  assert.equal(opened[0][2], 'noopener,noreferrer');
});

test('removed modules have no runtime imports or service links', () => {
  const index = read('index.html'), template = read('src/template.html'),
        build = read('src/build.py'), boot = read('src/boot.js');
  assert.equal(fs.existsSync(path.join(ROOT, 'src/gmail.js')), false);
  assert.doesNotMatch(index, /src\/gmail\.js/);
  assert.doesNotMatch(build, /'gmail\.js'/);
  retired.forEach(id => {
    for (const html of [template, index]) {
      assert.doesNotMatch(html, new RegExp('href="#'+id+'"'));
    }
  });
  assert.match(index, /nav-count">18<\/span>/);
  assert.doesNotMatch(boot, /result\.(?:tasks|notes|bookmarks|parcels|mailDrafts)\s*=/);
  assert.doesNotMatch(read('src/creative.js'), /register\('paint'/);
  assert.equal(fs.existsSync(path.join(ROOT, 'src/productivity.js')), false);
   assert.equal(fs.existsSync(path.join(ROOT, 'src/connected.js')), false);
  assert.doesNotMatch(read('src/pages.js'), /register\('parcels'/);
});

test('rebuilt index contains valid cache keys for every CSS and JS entry', () => {
  const index = read('index.html');
  const build = read('src/build.py');
  for (const name of ['CSS', 'JS']) {
    const match = build.match(new RegExp(name + '\\s*=\\s*\\[([\\s\\S]*?)\\]'));
    assert.ok(match, name);
    const paths = [...match[1].matchAll(/'([^']+)'/g)].map(m => path.posix.normalize('src/' + m[1]));
    for (const resource of paths) {
      const asset = fs.readFileSync(path.join(ROOT, resource));
      const sha = crypto.createHash('sha256').update(asset).digest('hex').slice(0, 12);
      const attribute = name === 'CSS' ? 'href' : 'src';
      assert.ok(index.includes(attribute + '="' + resource + '?v=' + sha + '"'),
        resource + ' missing correct cache key');
    }
  }
});

test('deleted page CSS selectors are absent; the games styles remain', () => {
  const css = ['src/style.css', 'src/creative.css']
    .map(read).join('\n');
  for (const selector of ['.gmail-page', '.mail-layout', '.parcel-live-panel',
    '.tracking-hero', '.paint-layout', '.prod-notes', '.prod-bookmark-toolbar',
    '.notes-layout', '.bookmark-card']) {
    assert.equal(css.includes(selector), false, selector);
  }
  assert.equal(fs.existsSync(path.join(ROOT, 'src/productivity.css')), false);
  assert.ok(css.includes('.games-card'));
});
