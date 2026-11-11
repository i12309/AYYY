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
 assert.deepEqual(Array.from(app.services,s=>s.id),['oberon','ai','search','weather','finance','mpp','tools','family','health','games']);
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
