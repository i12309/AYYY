/* Regression tests for the ephemeral CRT terminal. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('the supplied CRT mockup is full-screen and branded, without sidebar or topbar', () => {
  const html = read('terminal/index.html');
  assert.match(html, /class="terminal-brand"/);
  assert.match(html, /Нейронный терминал/);
  assert.match(html, /SCANLINES/);
  assert.match(html, /GLOW/);
  assert.match(html, /class="telemetry"/);
  assert.match(html, /operator@ayyy:~\$/);
  assert.doesNotMatch(html, /<aside class="sidebar"/);
  assert.doesNotMatch(html, /<header class="topbar"/);
});
test('the local conversation has no persistence or external inference calls', () => {
  const html = read('terminal/index.html');
  assert.doesNotMatch(html, /localStorage|sessionStorage|fetch\(|XMLHttpRequest|\/chat\/completions/);
  assert.match(html, /function getReply\(/);
  assert.match(html, /new URLSearchParams\(window.location.search\)/);
  assert.match(html, /target="_top"/);
  const route = read('src/neural-terminal-route.js');
  assert.match(route, /a.register\('ai'/);
  assert.match(route, /encodeURIComponent\(a.param.slice\(0,500\)\)/);
  assert.match(read('src/neural-terminal.css'), /body\[data-page="ai"\] \.sidebar/);
});
test('the static build includes the terminal directory but not retired modules', () => {
  const build = read('src/build.py');
  assert.match(build, /'terminal'\)/);
  assert.match(build, /'neural-terminal-route.js'/);
  assert.match(build, /'neural-terminal.css'/);
  for (const name of ['connected.js', 'productivity.js', 'productivity.css'])
    assert.doesNotMatch(build, new RegExp(name.replace('.', '\\.')));
});
