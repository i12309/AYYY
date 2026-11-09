/* Offline integration checks for the games portal. No browser dependency.
 * Run: node --test tests/games-portal.test.cjs
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '..');
const RUNTIME = path.join(ROOT, 'games/runtime');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const registry = ['game','learning','adventures'].flatMap(name =>
  require(path.join(RUNTIME, 'assets', `${name}-registry.js`)));

function filesAt(dir) {
  return fs.readdirSync(dir, {withFileTypes:true}).flatMap(entry =>
    entry.isDirectory() ? filesAt(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
}

test('all 16 source games and their advertised levels resolve inside AYYY', () => {
  assert.equal(registry.length, 16);
  assert.equal(new Set(registry.map(game => game.id)).size, 16);
  for (const game of registry) {
    for (const link of [game.link, ...game.levels.map(level => level.link)]) {
      const url = new URL(link, 'https://example.test/AYYY/games/runtime/');
      assert.equal(url.origin, 'https://example.test');
      assert.ok(url.pathname.startsWith(`/AYYY/games/runtime/games/${game.id}/`), link);
      assert.ok(fs.existsSync(path.resolve(RUNTIME, decodeURIComponent(link.split(/[?#]/)[0]))), link);
    }
  }
});

test('every runtime HTML dependency and local navigation target exists', () => {
  const htmlFiles = filesAt(RUNTIME).filter(file => file.endsWith('.html'));
  assert.equal(htmlFiles.length, 19, '16 games, coloring gallery, saved works, catalog redirect');
  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, 'utf8');
    for (const [,value] of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)) {
      if (/^(?:https?:|data:|blob:|mailto:|#)/i.test(value)) continue;
      const local = decodeURIComponent(value.split(/[?#]/)[0]);
      if (!local) continue;
      assert.ok(!local.startsWith('/'), `${file}: root-relative link breaks GitHub project Pages`);
      const target = path.resolve(path.dirname(file), local);
      assert.ok(target.startsWith(ROOT + path.sep), `${file}: dependency escapes repository`);
      assert.ok(fs.existsSync(target), `${path.relative(ROOT,file)}: missing ${value}`);
    }
    if (file !== path.join(RUNTIME, 'index.html')) {
      assert.match(html, /shared\/ayyy-theme\.css/, `${file}: visual theme missing`);
      assert.match(html, /shared\/ayyy-bridge\.js/, `${file}: portal navigation missing`);
    }
  }
});

test('the coloring library retains all 48 drawings and the original saved coordinate maps', () => {
  const dir = path.join(RUNTIME,'games/coloring');
  const original = fs.readFileSync(path.join(dir,'art-data.js'));
  const gitBlob = Buffer.concat([Buffer.from(`blob ${original.length}\0`),original]);
  assert.equal(crypto.createHash('sha1').update(gitBlob).digest('hex'),
    '3b0c84b6a68b4371ff9080ac5a74b8cf16cdfa26', 'existing eight drawings must remain save-compatible');
  const packs = fs.readdirSync(path.join(dir,'packs')).filter(name => name.endsWith('.js')).sort();
  const context = vm.createContext({window:{}});
  for (const file of ['art-data.js','pixel-art.js',...packs.map(name => `packs/${name}`)])
    vm.runInContext(fs.readFileSync(path.join(dir,file),'utf8'),context,{filename:file});
  const levels = context.window.PIXEL_LEVELS;
  assert.equal(levels.length,48);
  assert.equal(new Set(levels.map(level => level.id)).size,48);
  for (const level of levels) {
    const width = level.rows[0].length;
    for (const row of level.rows) {
      assert.equal(row.length,width,level.id);
      for (const color of row) if (color !== '.') assert.ok(level.palette[color],`${level.id}: missing color ${color}`);
    }
  }
  for (const name of ['index.html','gallery.html']) {
    const html = fs.readFileSync(path.join(dir,name),'utf8');
    const scripts = Array.from(html.matchAll(/<script\b[^>]*src=["']([^"']+)["']/g),match => match[1]);
    assert.ok(scripts.indexOf('art-data.js') < scripts.indexOf('pixel-art.js'));
    for (const pack of packs) assert.ok(scripts.includes(`packs/${pack}`));
  }
});

test('imported platform reuses the original local saves, including unavailable storage', () => {
  const store = new Map([['igroland.memory.best.v1',JSON.stringify({easy:{moves:3}})]]);
  const storage = {getItem:key => store.get(key) ?? null,setItem:(key,value) => store.set(key,value)};
  const context = vm.createContext({window:{},localStorage:storage});
  vm.runInContext(read('games/runtime/shared/platform.js'),context);
  assert.equal(context.window.Igroland.read('memory.best.v1').easy.moves,3);
  context.window.Igroland.write('memory.best.v1',{easy:{moves:4}});
  assert.equal(JSON.parse(store.get('igroland.memory.best.v1')).easy.moves,4);
  storage.getItem = () => { throw new Error('storage denied'); };
  storage.setItem = () => { throw new Error('storage denied'); };
  assert.equal(context.window.Igroland.read('memory.best.v1','fallback'),'fallback');
  assert.equal(context.window.Igroland.write('memory.best.v1',{}),false);
});

class NodeStub {
  constructor() {
    this.listeners = new Map(); this.dataset = {}; this.hidden = false;
    this.disabled = false; this.innerHTML = ''; this.textContent = '';
    this.style = {setProperty(){}};
    this.classList = {add(){},remove(){},toggle(){}};
  }
  addEventListener(name,fn) { if (!this.listeners.has(name)) this.listeners.set(name,new Set()); this.listeners.get(name).add(fn); }
  removeEventListener(name,fn) { this.listeners.get(name)?.delete(fn); }
  emit(name,event={}) { for (const fn of this.listeners.get(name) || []) fn(event); }
  setAttribute() {}
  setPointerCapture() {}
}

function legacyHarness(saved) {
  const nodes = new Map(),store = new Map(Object.entries(saved));
  const document = new NodeStub();
  const getNode = selector => { if (!nodes.has(selector)) nodes.set(selector,new NodeStub()); return nodes.get(selector); };
  const host = {querySelector:getNode,querySelectorAll:() => []};
  const app = {
    escape:String,icon:() => '',register(){},
    get:(key,fallback) => store.has(key) ? JSON.parse(JSON.stringify(store.get(key))) : fallback,
    set:(key,value) => store.set(key,JSON.parse(JSON.stringify(value)))
  };
  const context = vm.createContext({window:{AYYY:app},document,Math,Date,console});
  vm.runInContext(read('src/creative.js'),context,{filename:'src/creative.js'});
  return {app,document,host,store,getNode};
}

test('legacy 2048 restores saves, merges, undoes and stops keyboard input on route exit', () => {
  const original = {grid:[2,2,...Array(14).fill(0)],score:0,moves:0,won:false};
  const x = legacyHarness({games_2048:original,games_2048_best:16});
  assert.match(x.app.legacyGames.render('2048'),/gp-legacy-stage/);
  assert.match(x.app.legacyGames.render('math'),/id="math-answers"/);
  assert.equal(x.app.legacyGames.render('constructor'),'');
  const destroy = x.app.legacyGames.mount('2048',x.host);
  assert.deepEqual(x.store.get('games_2048'),original);
  const press = () => x.document.emit('keydown',{key:'ArrowLeft',target:{tagName:'DIV'},preventDefault(){}});
  press();
  assert.equal(x.store.get('games_2048').grid[0],4);
  assert.equal(x.store.get('games_2048').score,4);
  assert.equal(x.store.get('games_2048').moves,1);
  assert.equal(x.store.get('games_2048_best'),16);
  x.getNode('#g2048-undo').emit('click');
  assert.deepEqual(x.store.get('games_2048'),original);
  destroy();
  press();
  assert.deepEqual(x.store.get('games_2048'),original);
  assert.equal(x.document.listeners.get('keydown').size,0);
});

test('imported memory displays each found pair immediately, including before completion', () => {
  const nodes=new Map(),store=new Map();
  const node=()=>{const n=new NodeStub();n.children=[];n.firstChild={textContent:''};
    n.append=(...children)=>n.children.push(...children);n.replaceChildren=(...children)=>{n.children=children;};return n;};
  const get=selector=>{if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);};
  const difficulties=['easy','normal','hard'].map(id=>{const n=node();n.dataset.difficulty=id;return n;});
  const app={read:(key,fallback)=>store.get(key)??fallback,write:(key,value)=>{store.set(key,value);return true;},
    duration:()=> '00:00',sound(){},soundEnabled:()=>false,setSound(){}};
  const document={querySelector:get,querySelectorAll:()=>difficulties,createElement:node,hidden:false};
  const context=vm.createContext({window:{Igroland:app,addEventListener(){}},document,Math,URLSearchParams,
    location:{search:'?level=easy'},setInterval:()=>1,setTimeout:()=>1,clearTimeout(){}});
  vm.runInContext(read('games/runtime/games/memory/memory.js'),context);
  assert.equal(get('#pairCount').textContent,'0/3');
  const order=store.get('memory.sessions.v1').easy.order,board=get('#memoryBoard');
  let pairs=0;
  for(const value of new Set(order)){
    const indexes=order.map((icon,index)=>icon===value?index:-1).filter(index=>index>=0);
    indexes.forEach(index=>board.children[index].emit('click'));
    pairs++;
    assert.equal(get('#pairCount').textContent,`${pairs}/3`);
    assert.equal(get('#moveCount').textContent,String(pairs));
    assert.equal(store.get('memory.sessions.v1').easy.matched.length,pairs*2);
  }
  assert.equal(store.get('memory.sessions.v1').easy.won,true);
});

test('lazy games loading cannot mount over a different route after navigation', async () => {
  const nodes = [],events = [],view = {isConnected:true};
  const app = {route:'games',views:{},register(name,definition){this.views[name]=definition;}};
  const window = {AYYY:app,AYYYGamesPortal:{mount(){events.push('mount');return {destroy(){events.push('destroy');}};}}};
  const document = {
    baseURI:'https://example.test/AYYY/',body:{dataset:{}},
    getElementById:id => id==='ayyy-games-root' ? view : nodes.find(node=>node.id===id),
    createElement:tagName => ({tagName,remove(){this.removed=true;}}),
    head:{appendChild(node){nodes.push(node);}}
  };
  const context = vm.createContext({window,document,URL,setTimeout:()=>1,clearTimeout(){}});
  vm.runInContext(read('src/games-route.js'),context);
  assert.equal(nodes.filter(node=>node.tagName==='script'||node.tagName==='link').length,0,
    'visiting home should not fetch the game catalog');
  const stop = app.views.games.mount();
  stop(); app.route='weather';
  for(let n=0;n<20;n++) {
    nodes.find(node=>node.onload && !node.removed)?.onload();
    await Promise.resolve();
  }
  assert.deepEqual(events,[], 'finishing a download must not resurrect a disposed route');
  app.route='games';
  const stopAgain = app.views.games.mount();
  for(let n=0;n<5;n++) await Promise.resolve();
  assert.deepEqual(events,['mount']);
  assert.equal(nodes.filter(node=>node.tagName==='script').length,3,'cached scripts are reused');
  stopAgain();
  assert.deepEqual(events,['mount','destroy']);
});

test('runtime bridge accepts settings only from its same-origin parent and keeps game links framed', () => {
  const windowEvents = new Map(),documentEvents = new Map(),sent = [];
  const parent = {postMessage:(data,origin) => sent.push({data,origin})};
  const window = {parent,addEventListener:(name,fn)=>windowEvents.set(name,fn)};
  const location = new URL('https://example.test/AYYY/games/runtime/games/memory/index.html?level=easy');
  const root = {dataset:{}};
  let mode='hard',changed;
  class Anchor {
    constructor(href) { this.href=href;this.target='_blank'; }
    closest() { return this; }
    hasAttribute() { return false; }
  }
  const document = {
    currentScript:{src:'https://example.test/AYYY/games/runtime/shared/ayyy-bridge.js'},
    documentElement:root,addEventListener:(name,fn)=>documentEvents.set(name,fn),
    title:'Найди пару — Остров игр AYYY',querySelectorAll:()=>[],
    querySelector:selector=>selector==='[data-difficulty][aria-pressed="true"]'?{dataset:{difficulty:mode}}:null
  };
  const context = vm.createContext({window,document,location,URL,Element:Anchor,
    history:{state:{},replaceState(state,title,url){location.href=String(url);},pushState(){}},requestAnimationFrame:()=>1,
    MutationObserver:class {constructor(fn){changed=fn;}observe(){}disconnect(){}},
    setTimeout:()=>1,clearTimeout(){},cancelAnimationFrame(){}});
  vm.runInContext(read('games/runtime/shared/ayyy-bridge.js'),context);
  const settings={type:'ayyy-games:settings',palette:'sand',quiet:true};
  windowEvents.get('message')({source:{},origin:location.origin,data:settings});
  windowEvents.get('message')({source:parent,origin:'https://other.test',data:settings});
  assert.equal(root.dataset.ayyyPalette,undefined);
  windowEvents.get('message')({source:parent,origin:location.origin,data:settings});
  assert.equal(root.dataset.ayyyPalette,'sand');
  assert.equal(root.dataset.ayyyQuiet,'true');
  windowEvents.get('message')({source:parent,origin:location.origin,data:{...settings,palette:'unknown'}});
  assert.equal(root.dataset.ayyyPalette,'sand');
  let prevented=false;
  const catalog=new Anchor('https://example.test/AYYY/games/runtime/index.html?section=learn');
  documentEvents.get('click')({target:catalog,preventDefault(){prevented=true;}});
  assert.equal(prevented,true);
  assert.equal(sent.at(-1).data.type,'ayyy-games:catalog');
  assert.equal(sent.at(-1).origin,location.origin);
  const gallery=new Anchor('https://example.test/AYYY/games/runtime/games/coloring/gallery.html');
  documentEvents.get('click')({target:gallery,preventDefault(){assert.fail('internal game navigation was blocked');}});
  assert.equal(gallery.target,'_self');
  const external=new Anchor('https://other.test/AYYY/games/runtime/index.html');
  documentEvents.get('click')({target:external,preventDefault(){assert.fail('unrelated link was captured');}});
  assert.equal(external.target,'_blank');
  documentEvents.get('DOMContentLoaded')();
  assert.equal(location.searchParams.get('level'),'hard','resume points at actual selected difficulty');
  assert.ok(sent.some(event=>event.data.type==='ayyy-games:ready'&&event.data.path.includes('level=hard')));
  mode='normal';changed();
  assert.equal(location.searchParams.get('level'),'normal','changing difficulty updates resume path');
  assert.ok(sent.some(event=>event.data.type==='ayyy-games:location'&&event.data.path.includes('level=normal')));
});

test('paper marble renderer preserves color identities and finite coordinate transforms', () => {
  const levels=require(path.join(RUNTIME,'games/marble-shooter/levels.js'));
  const core=require(path.join(RUNTIME,'games/marble-shooter/engine.js'));
  const colors=new Set();
  const numericArgs=args=>{for(const value of args)if(typeof value==='number')assert.ok(Number.isFinite(value));};
  const ctx=new Proxy({}, {get(object,key){
    if(key==='createLinearGradient'||key==='createRadialGradient')return (...args)=>{
      numericArgs(args);return {addColorStop(offset,color){numericArgs([offset]);colors.add(color);}};
    };
    return object[key] ?? ((...args)=>numericArgs(args));
  },set(object,key,value){object[key]=value;return true;}});
  const canvas=()=>({width:960,height:680,getContext:()=>ctx});
  const window={MarbleLevels:levels,MarbleEngine:core,devicePixelRatio:2};
  const context=vm.createContext({window,document:{createElement:canvas},Math});
  vm.runInContext(read('games/runtime/games/marble-shooter/renderer.js'),context);
  const renderer=new window.MarbleRenderer(canvas());
  for(const color of levels.COLORS)assert.ok(colors.has(color.hex));
  for(const [w,h] of [[960,680],[600,820]])for(const level of levels.LEVELS){
    const game=new core.Game(level,'normal',7,w,h);
    game.freezeTime=2;
    game.effects=[{x:60,y:60,color:0,life:.5}];
    game.projectile={x:100,y:100,color:1,bomb:false};
    renderer.setSize(w,h);renderer.highlight=game.chain.length-1;
    for(const zoom of [1,1.5,1.9]){
      renderer.setZoom(zoom,w*.6,h*.4);
      const screen=renderer.worldToScreen(123,234),world=renderer.screenToWorld(screen.x,screen.y);
      assert.ok(Math.abs(world.x-123)<1e-7&&Math.abs(world.y-234)<1e-7);
      const before=JSON.stringify(game);
      renderer.draw(game,1234);
      assert.equal(JSON.stringify(game),before,'rendering must not change game state');
    }
  }
  assert.ok(colors.has('#fffefb')&&colors.has('#f5f3e8'),'paper scene palette');
});
