/* Ten distinct directory entries, with backward compatibility for old utility shortcuts. */
const test=require('node:test'), assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
function setup(){
 const stored=new Map(),window={};
 const ctx=vm.createContext({window,document:{},localStorage:{getItem(k){return stored.get(k)??null;},setItem(k,v){stored.set(k,v);}}});
 for(const p of ['src/core.js','src/pages.js','src/splash.js','src/showcase.js'])vm.runInContext(read(p),ctx,{filename:p});
 return {app:window.AYYY,stored};
}
test('one catalog item per real service route',()=>{
 const {app}=setup();
 assert.equal(app.services.length,10);
 assert.equal(new Set(app.services.map(s=>s.route)).size,10);
 assert.deepEqual(Array.from(app.services,s=>s.id),['oberon','health','weather','family','games','finance','tools','mpp','search','ai']);
 assert.equal(app.services.find(s=>s.id==='tools').param,'loan');
 assert.equal(app.services.filter(s=>s.route==='tools').length,1);
});
test('legacy utility shortcuts and favorites still work',()=>{
 const {app,stored}=setup();
 stored.set('ayyy:v1:favorites',JSON.stringify(['calc','percent','loan','science','converter','json','games','finance']));
 assert.equal(Array.from(app.favorites()).join(','),'tools,games,finance');
 for(const id of ['calc','loan','science','percent','converter','dates','password','json','text','color'])assert.equal(app.serviceId(id),'tools');
 assert.equal(app.serviceId('2048'),'games');
 stored.set('ayyy:v1:home.shortcuts',JSON.stringify(['converter','calc','games']));
 assert.equal((app.views.home.render().match(/href="#tools\/loan"/g)||[]).length,1);
});
test('showcase has search, categories, individual info, and connection indicators',()=>{
 const {app}=setup(),html=app.views.directory.render(),source=read('src/showcase.js');
 assert.match(html,/class="sc-list"/);
 assert.match(html,/id="catalog-search"/);
 assert.match(html,/data-category="favorites"/);
 assert.match(html,/id="catalog-count"/);
 assert.match(source,/data-sc-connection/);
 for(const db of ['ayyy-health-v2','ayyy-family-v1','ayyy-oberon-v1']) assert.ok(source.includes(db));
 assert.doesNotMatch(html,/shore-catalog-grid/);
});

test('ten illustrated stories replace the lighthouse on hover, then restore it',()=>{
 const {app}=setup(),html=app.views.directory.render(),source=read('src/showcase.js');
 assert.match(html,/data-sc-picture="default"[^>]*assets\/lighthouse-watercolor\.webp/);
 const previews=[...html.matchAll(/data-sc-picture="([a-z]+)"/g)].map(hit=>hit[1]);
 assert.equal(previews.length,11);
 assert.deepEqual(previews.slice(1),Array.from(app.services,s=>s.id));
 for(const id of previews.slice(1)){
   const filename='assets/service-art/v1/'+id+'-hero.webp';
   assert.ok(fs.existsSync(path.join(root,filename)),filename);
   const bytes=fs.readFileSync(path.join(root,filename));
   assert.equal(bytes.toString('ascii',0,4),'RIFF',filename);
   assert.equal(bytes.toString('ascii',8,12),'WEBP',filename);
 }
 assert.match(source,/grid\.addEventListener\('pointerover',pointerOver\)/);
 assert.match(source,/grid\.addEventListener\('pointerout',pointerOut\)/);
 assert.match(source,/grid\.addEventListener\('focusin',focusIn\)/);
 assert.match(source,/showScene\(null\)/);
});
test('compact rows fill the available width and retain expandable descriptions',()=>{
 const css=read('src/showcase.css'),source=read('src/showcase.js');
 assert.match(css,/\.sc-shell\s*\{[^}]*width:100%/);
 assert.match(css,/\.sc-row\s*\{[^}]*min-height:168px/);
 assert.match(css,/position:sticky/);
 assert.match(source,/<details class="sc-card-more">/);
 assert.match(source,/data-sc-connection/);
 assert.match(source,/sc-card-cover/);
});

test('gallery uses a true grid column and a constrained sticky inner scene',()=>{
  const css=read('src/showcase.css'),source=read('src/showcase.js');
  assert.match(source,/class="sc-gallery-sticky"/);
  assert.match(css,/\.sc-page \.sc-gallery \{\s*position:relative/);
  assert.match(css,/\.sc-page \.sc-gallery-sticky \{\s*position:sticky/);
  assert.match(css,/\.sc-page \.sc-gallery-frame \{[\s\S]*?overflow:hidden/);
  assert.match(css,/width:min\(76%,420px\)/);
  assert.match(css,/grid-template-columns:clamp\(260px,26vw,440px\) minmax\(0,1fr\)/);
  assert.ok(!css.includes('position:fixed'), 'gallery should not float outside the grid');
  assert.match(css, /@media \(max-width:980px\)/);
});
