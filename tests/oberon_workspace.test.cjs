// Coordinator regression tests: no browser, credentials, or real network needed.
// Run with node --test tests/oberon_workspace.test.cjs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {webcrypto} = require('node:crypto');
const {TextEncoder, TextDecoder} = require('node:util');

const clone = value => structuredClone(value);
const note = (path, content) => ({id:path, path, content, favorite:false, updated:null});
const notes = value => Object.fromEntries(value.notes.map(n => [n.path, n.content]));
const defaults = () => ({notes:[], folders:[], active:null, tabs:[], autoSync:false, syncConflict:null, theme:'paper'});
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve=yes; reject=no; });
  return {promise, resolve, reject};
};
const turn = () => new Promise(resolve => setImmediate(resolve));
async function until(condition, message='Expected async operation did not complete') {
  for (let i=0; i<60; i++) { if(condition()) return; await turn(); }
  assert.fail(message);
}
async function settled() { for (let i=0; i<6; i++) await turn(); }

async function harness() {
  const connection = {owner:'owner', repo:'notes', branch:'main', private:false, canWrite:false, repoId:42};
  const initial = {...defaults(), notes:[note('a.md','original a'), note('b.md','original b')], active:'a.md', tabs:['a.md']};
  const remote = {notes:clone(initial.notes), folders:[], commit:'original-commit', tree:'original-tree', entries:{}, repository:connection};
  const records = new Map([
    ['vault', {id:'vault', kind:'github', name:'Notes', connection:clone(connection), snapshot:clone(initial), base:clone(remote), revision:1, dirty:false}],
    ['demo', {id:'demo', kind:'demo', name:'Demo', connection:null, snapshot:clone(initial), base:null, revision:1, dirty:false}]
  ]);
  const io = {remote:clone(remote), load:null, sync:null, beforeSave:null, loads:[], syncs:[], saves:[], clients:[]};
  const storage = {
    ensureDemo:async()=>clone(records.get('demo')),
    list:async()=>[...records.values()].map(clone),
    get:async id=>clone(records.get(id)||null),
    create:async value=>{
      if(records.has(value.id))throw Object.assign(Error('Already exists'),{code:'LOCAL_CONFLICT'});
      const result={...clone(value),revision:1};records.set(value.id,result);return clone(result);
    },
    save:async(value,revision)=>{
      // Like IndexedDB, capture the requested write before yielding. The CAS is
      // checked when the controlled transaction runs, not by the caller.
      const captured=clone(value);io.saves.push({value:captured,revision});
      if(io.beforeSave)await io.beforeSave(captured,revision);
      if(records.get(captured.id)?.revision!==revision)throw Object.assign(Error('Changed in another tab'),{code:'LOCAL_CONFLICT'});
      const result={...captured,revision:revision+1};records.set(result.id,result);return clone(result);
    },
    remove:async(id,revision)=>{
      if(records.get(id)?.revision!==revision)throw Object.assign(Error('Changed in another tab'),{code:'LOCAL_CONFLICT'});
      records.delete(id);
    }
  };
  const nodes=new Map(), listeners=new Map();
  let selects=[], homeActions, timerId=0;
  const timers=new Map();
  const element=selector=>{
    if(!nodes.has(selector))nodes.set(selector,{hidden:false,disabled:false,textContent:'',value:'',checked:false,dataset:{},
      classList:{add(){},remove(){}},addEventListener(name,callback){this['on'+name]=callback;}});
    return nodes.get(selector);
  };
  const document={
    title:'',querySelector:element,
    querySelectorAll:selector=>selector==='[data-conflict-index]'?selects:[],
    addEventListener:(name,callback)=>listeners.set(name,callback)
  };
  let state=clone(initial);
  const editor={
    dialogs:[],toasts:[],contexts:[],exports:[],
    snapshot:()=>clone(state),defaults,
    load:value=>{state=clone(value);},apply:value=>{state=clone(value);},patch:value=>{state={...state,...clone(value)};},
    show(){},hide(){},cancelSaveTimer(){},toggleTheme(){},
    context:value=>editor.contexts.push(clone(value)),toast:value=>editor.toasts.push(value),
    export:value=>editor.exports.push(clone(value)),
    dialog:html=>{
      editor.dialogs.push(html);
      selects=[...html.matchAll(/data-conflict-index="(\d+)"/g)].map(match=>({dataset:{conflictIndex:match[1]},value:''}));
    },
    closeDialog:()=>element('#modal').onclose?.()
  };
  const location={search:'',pathname:'/oberon/',origin:'https://portal.example'};
  const window={OberonStorage:storage,OBERON_SEED:clone(initial),
    OberonHome:{mount:(_root,actions)=>{homeActions=actions;return {render(){}};}},
    addEventListener(){},top:{location:{href:''}}};
  const context=vm.createContext({window,document,location,history:{replaceState(){}},URL,URLSearchParams,
    structuredClone,TextEncoder,TextDecoder,crypto:webcrypto,AbortController,
    setTimeout:(callback,delay)=>{const id=++timerId;timers.set(id,{callback,delay});return id;},
    clearTimeout:id=>timers.delete(id)});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../oberon/github.js'),'utf8'),context,{filename:'oberon/github.js'});
  const real=window.OberonGitHub;
  window.OberonGitHub={...real,create:(requested,token)=>{
    const client={aborted:false,connection:clone(requested),hasToken:!!token,
      verify:async()=>({...connection,...clone(requested),canWrite:!!token}),
      load:async()=>{io.loads.push(client);return io.load?io.load(client):{...clone(io.remote),repository:{...clone(io.remote.repository),canWrite:!!token}};},
      sync:async request=>{
        io.syncs.push(clone({base:request.base,local:request.local}));
        if(io.sync)return io.sync(request,client);
        const merged=real.merge(request.base,request.local,io.remote);
        if(merged.conflicts.length)throw Object.assign(Error('Conflict'),{code:'CONFLICT',conflicts:merged.conflicts,remote:clone(io.remote),merged});
        return {snapshot:{...clone(io.remote),notes:merged.notes,folders:merged.folders},changed:1};
      },
      abort(){this.aborted=true;}
    };io.clients.push(client);return client;
  }};
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../oberon/workspace.js'),'utf8'),context,{filename:'oberon/workspace.js'});
  const workspace=window.OberonWorkspace;
  await workspace.start(editor);
  return {workspace,editor,records,io,element,defaults,remote,
    current:()=>editor.snapshot(),
    set:(path,content)=>{
      const snapshot=editor.snapshot(),existing=snapshot.notes.find(n=>n.path===path);
      if(content===null)snapshot.notes=snapshot.notes.filter(n=>n.path!==path);
      else if(existing)existing.content=content;
      else snapshot.notes.push(note(path,content));
      editor.apply(snapshot);workspace.markPending();
    },
    open:async id=>{homeActions.onOpen(id);await until(()=>workspace.activeId()===id);await settled();},
    authorize:async()=>{
      workspace.authorize();element('#authorize-token').value='unit-test-credential';
      await element('#authorize-form').onsubmit({preventDefault(){}});await settled();
    },
    choose:async(side='local')=>{
      for(const select of selects)select.value=side;
      const submit=element('#conflict-form').onsubmit;assert.equal(typeof submit,'function','Expected a conflict form');
      await submit({preventDefault(){}});await settled();
    },
    action:name=>listeners.get('click')?.({target:{closest:selector=>selector==='[data-ws]'?{dataset:{ws:name}}:null}})
  };
}

test('remote refresh merges edits typed while the network request is pending',async()=>{
  const h=await harness();await h.open('vault');
  const load=deferred();let started=false;
  h.io.load=()=>{started=true;return load.promise;};
  const syncing=h.workspace.sync();await until(()=>started);
  h.set('a.md','typed while reading GitHub');
  const remote={...clone(h.remote),notes:[note('a.md','original a'),note('b.md','remote b')],commit:'new-commit'};
  load.resolve(remote);await syncing;
  assert.deepEqual(notes(h.current()),{'a.md':'typed while reading GitHub','b.md':'remote b'});
  assert.deepEqual(notes(h.records.get('vault').snapshot),notes(h.current()));
  assert.equal(h.records.get('vault').base.commit,'new-commit');
  assert.equal(h.current().syncConflict,null);
});

test('a pending draft transaction cannot roll back a confirmed remote base',async()=>{
  const h=await harness();await h.open('vault');
  const load=deferred(),write=deferred();let reading=false,writing=false;
  h.io.load=()=>{reading=true;return load.promise;};
  const syncing=h.workspace.sync();await until(()=>reading);
  h.set('a.md','later local edit');
  h.io.beforeSave=()=>{if(!writing){writing=true;return write.promise;}};
  const saving=h.workspace.save(h.current());await until(()=>writing);
  const remote={...clone(h.remote),notes:[note('a.md','original a'),note('b.md','remote b')],commit:'confirmed-commit'};
  load.resolve(remote);await settled();write.resolve();
  await Promise.all([saving,syncing]);
  const persisted=h.records.get('vault');
  assert.equal(persisted.base.commit,'confirmed-commit','An older IndexedDB callback must not replace the confirmed base');
  assert.deepEqual(notes(persisted.base),{'a.md':'original a','b.md':'remote b'});
  assert.deepEqual(notes(persisted.snapshot),{'a.md':'later local edit','b.md':'remote b'});
  assert.equal(persisted.dirty,true);
});

test('postponed conflict resolution preserves subsequent edits and new notes',async()=>{
  const h=await harness();await h.open('vault');
  const load=deferred();let reading=false;
  h.io.load=()=>{reading=true;return load.promise;};
  const syncing=h.workspace.sync();await until(()=>reading);
  h.set('a.md','first local conflict');
  load.resolve({...clone(h.remote),notes:[note('a.md','remote conflict'),note('b.md','original b')],commit:'conflicted-commit'});
  await syncing;assert.equal(h.current().syncConflict.conflicts.length,1);
  h.action('close');
  h.set('a.md','latest local conflict');h.set('b.md','unrelated later edit');h.set('new.md','created after postponing');
  await h.workspace.save(h.current());
  h.workspace.connection();await h.choose('local');
  assert.deepEqual(notes(h.current()),{'a.md':'latest local conflict','b.md':'unrelated later edit','new.md':'created after postponing'});
  assert.deepEqual(notes(h.records.get('vault').snapshot),notes(h.current()));
  assert.equal(h.current().syncConflict,null);
});

test('CAS disagreement merges disjoint edits from two tabs before saving',async()=>{
  const h=await harness();await h.open('demo');
  h.set('a.md','this tab');
  const external=clone(h.records.get('demo'));external.revision++;external.snapshot.notes.find(n=>n.path==='b.md').content='other tab';
  h.records.set('demo',external);
  assert.equal(await h.workspace.flush(),false);
  assert.equal(notes(h.records.get('demo').snapshot)['a.md'],'original a','Failed CAS must not replace the other tab');
  h.workspace.connection();await settled();
  assert.deepEqual(notes(h.current()),{'a.md':'this tab','b.md':'other tab'});
  assert.deepEqual(notes(h.records.get('demo').snapshot),notes(h.current()));
});

test('CAS conflict chosen later retains edits made after postponing',async()=>{
  const h=await harness();await h.open('demo');
  h.set('a.md','first local');
  const external=clone(h.records.get('demo'));external.revision++;external.snapshot.notes.find(n=>n.path==='a.md').content='other tab';
  h.records.set('demo',external);assert.equal(await h.workspace.flush(),false);
  h.workspace.connection();await settled();h.action('close');
  h.set('a.md','latest local');h.set('b.md','later unrelated');h.set('new.md','new after conflict');
  h.workspace.connection();await settled();await h.choose('local');
  assert.deepEqual(notes(h.current()),{'a.md':'latest local','b.md':'later unrelated','new.md':'new after conflict'});
  assert.deepEqual(notes(h.records.get('demo').snapshot),notes(h.current()));
});

test('a response arriving after leaving the vault cannot affect the next vault',async()=>{
  const h=await harness();await h.open('vault');
  const load=deferred();let reading=false;
  h.io.load=()=>{reading=true;return load.promise;};
  const syncing=h.workspace.sync();await until(()=>reading);
  await h.workspace.home();await h.open('demo');
  const before=h.current();
  load.resolve({...clone(h.remote),notes:[note('wrong.md','must not enter demo')],commit:'late-commit'});await syncing;
  assert.equal(h.workspace.activeId(),'demo');assert.deepEqual(h.current(),before);
  assert.equal(h.records.get('vault').base.commit,'original-commit');
});

test('leaving a vault saves edits typed while the exit flush is pending',async()=>{
  const h=await harness();await h.open('demo');h.set('a.md','before leaving');
  const write=deferred();let writing=false;
  h.io.beforeSave=()=>{if(!writing){writing=true;return write.promise;}};
  const leaving=h.workspace.home();await until(()=>writing);
  h.set('a.md','last keystrokes while saving');write.resolve();await leaving;
  assert.equal(h.workspace.hasActive(),false);
  await h.open('demo');
  assert.equal(notes(h.current())['a.md'],'last keystrokes while saving');
});

test('simultaneous sync actions share one network operation after flushing',async()=>{
  const h=await harness();await h.open('vault');
  const load=deferred();let reads=0;
  h.io.load=()=>{reads++;return load.promise;};
  const first=h.workspace.sync(),second=h.workspace.sync();
  await until(()=>reads>0);await settled();
  assert.equal(reads,1,'Two clicks during the same flush must not start two writers');
  load.resolve(clone(h.remote));await Promise.all([first,second]);
  assert.equal(reads,1);
});

test('a conflict resolved by edits during the request does not leave an empty blocking dialog',async()=>{
  const h=await harness();await h.open('vault');await h.authorize();
  h.set('a.md','sent local version');
  const write=deferred();let writing=false;
  h.io.sync=()=>{writing=true;return write.promise;};
  const syncing=h.workspace.sync();await until(()=>writing);
  h.set('a.md','remote version');
  const remote={...clone(h.remote),notes:[note('a.md','remote version'),note('b.md','remote unrelated')],commit:'resolved-commit'};
  write.reject(Object.assign(Error('Conflict discovered'),{code:'CONFLICT',remote}));
  await syncing;
  assert.equal(h.current().syncConflict,null);
  assert.equal(h.records.get('vault').base.commit,'resolved-commit');
  assert.deepEqual(notes(h.current()),{'a.md':'remote version','b.md':'remote unrelated'});
});
