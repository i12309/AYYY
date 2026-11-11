/* Portal routing and complete build output for the separate OBERON app. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const {spawnSync} = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

function portal(hash = '#oberon') {
  const elements = new Map();
  const view = {innerHTML: ''};
  const frame = {src: ''};
  const styles = [];
  const body = {dataset: {}, classList: {remove() {}}};
  const document = {
    baseURI: 'https://example.test/AYYY/', body,
    head: {appendChild(node) {styles.push(node); elements.set(node.id, node);}},
    createElement: () => ({id: '', textContent: ''}),
    getElementById: id => id === 'ayyy-oberon-frame' ? frame : elements.get(id),
    querySelector: selector => selector === '#view' ? view : selector === '#page-label' ? {} : null,
    querySelectorAll: () => []
  };
  const window = {scrollTo() {}};
  const ctx = vm.createContext({window, document, URL, location: {hash}, localStorage: {getItem() {return null;}}});
  vm.runInContext(read('src/core.js'), ctx, {filename: 'src/core.js'});
  vm.runInContext(read('src/oberon-route.js'), ctx, {filename: 'src/oberon-route.js'});
  return {app: window.AYYY, document, ctx, frame, styles, view};
}

function frameURL(html) {
  const src = html.match(/\bsrc="([^"]+)"/);
  assert.ok(src, 'the view contains an iframe URL');
  return new URL(src[1].replace(/&amp;/g, '&'));
}

test('OBERON is a discoverable personal service and uses its own full-screen shell', () => {
  const p = portal();
  const service = p.app.services.find(service => service.id === 'oberon');
  assert.equal(service.name, 'OBERON');
  assert.equal(service.group, 'personal');
  assert.equal(service.route, 'oberon');
  assert.match(service.desc, /Markdown.*GitHub/);
  assert.equal(p.app.services.filter(service => service.id === 'oberon').length, 1);
  p.app.render();
  assert.equal(p.document.body.dataset.shell, 'oberon');
  assert.equal(p.document.title, 'OBERON · AYYY');
  assert.equal(frameURL(p.view.innerHTML).pathname, '/AYYY/oberon/');
  assert.equal(frameURL(p.view.innerHTML).searchParams.has('demo'), false);
  assert.match(p.view.innerHTML, /title="OBERON · заметки Markdown"/);
  assert.match(p.styles[0].textContent, /body\[data-shell="oberon"\].*height:100svh/);
  p.app.cleanup();
  assert.equal(p.frame.src, 'about:blank');
});

test('demo deep link opens the single app demo without forwarding arbitrary route content', () => {
  const p = portal('#oberon/demo');
  p.app.render();
  const demo = frameURL(p.view.innerHTML);
  assert.equal(demo.origin, 'https://example.test');
  assert.equal(demo.searchParams.get('demo'), '1');
  assert.ok(demo.searchParams.get('v'));
  p.app.param = 'demo&token=secret';
  const unknown = frameURL(p.app.views.oberon.render());
  assert.equal(unknown.searchParams.has('demo'), false);
  assert.equal(unknown.searchParams.has('token'), false);
  assert.equal(p.app.views.notes, undefined);
});

test('route loading is idempotent and navigation keeps the retired notes route absent', () => {
  const p = portal();
  vm.runInContext(read('src/oberon-route.js'), p.ctx);
  assert.equal(p.styles.length, 1);
  assert.match(read('src/template.html'), /href="#oberon"[^>]*data-nav="oberon"/);
  assert.doesNotMatch(read('src/template.html'), /href="#notes"/);
});

test('both external and inline builds carry the standalone OBERON files', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ayyy-oberon-build-'));
  try {
    const script = String.raw`
import pathlib, runpy, sys
namespace = runpy.run_path(sys.argv[1])
root = pathlib.Path(sys.argv[2])
source = root / 'source' / 'src'
source.mkdir(parents=True)
(source / 'template.html').write_text('<html><head><style>/*__STYLES__*/</style></head><body><script>/*__SCRIPTS__*/</script></body></html>')
for entry in namespace['CSS'] + namespace['JS']:
    target = source / entry
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text('/* fixture ' + entry + ' */')
app = source.parent / 'oberon'
app.mkdir()
(app / 'index.html').write_text('<h1>OBERON fixture</h1>')
(app / 'app.js').write_text('window.OBERON=true;')
(app / 'oberon-mark.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg"/>')
build = namespace['build']
build.__globals__['ROOT'] = source
build(root / 'external' / 'index.html')
build(root / 'inline' / 'index.html', inline=True)
`;
    const result = spawnSync('python3', ['-c', script, path.join(ROOT, 'src/build.py'), tmp], {encoding:'utf8'});
    assert.equal(result.status, 0, result.stderr || result.stdout);
    for (const mode of ['external', 'inline']) {
      const out = path.join(tmp, mode);
      assert.equal(fs.readFileSync(path.join(out, 'oberon/index.html'), 'utf8'), '<h1>OBERON fixture</h1>');
      assert.equal(fs.readFileSync(path.join(out, 'oberon/app.js'), 'utf8'), 'window.OBERON=true;');
      assert.ok(fs.existsSync(path.join(out, 'oberon/oberon-mark.svg')));
      assert.ok(fs.existsSync(path.join(out, '.nojekyll')));
    }
    const external = fs.readFileSync(path.join(tmp, 'external/index.html'), 'utf8');
    assert.match(external, /src="src\/oberon-route\.js\?v=[0-9a-f]{12}"/);
    const inline = fs.readFileSync(path.join(tmp, 'inline/index.html'), 'utf8');
    assert.match(inline, /fixture oberon-route\.js/);
  } finally {
    fs.rmSync(tmp, {recursive:true, force:true});
  }
});
