const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// A queued IndexedDB boundary for storage contract tests. Each write transaction
// takes a snapshot at its turn, commits atomically, and rolls back on abort.
// Real browser coverage remains in the application smoke workflow.
function indexedDBFixture() {
  const db = {records:new Map(), transactions:[], active:false, created:false, rejectNextWrite:null,
    objectStoreNames:{contains:() => db.created},
    createObjectStore() {db.created=true;}, close() {},
    transaction(name, mode) {
      const tx = new Transaction(db, mode);
      db.transactions.push(tx);
      setImmediate(() => pump());
      return tx;
    }};
  function pump() {
    if (db.active || !db.transactions.length) return;
    db.active=true;
    const tx=db.transactions.shift();
    tx.values=new Map([...db.records].map(([k,v]) => [k,structuredClone(v)]));
    setImmediate(() => tx.drain());
  }
  class Transaction {
    constructor(db, mode) {this.db=db;this.mode=mode;this.pending=[];this.done=false;this.error=null;}
    objectStore() {
      const request = operation => {const req={};this.pending.push({req,operation});return req;};
      const writing = operation => request(() => {
        if (db.rejectNextWrite) {const error=db.rejectNextWrite;db.rejectNextWrite=null;throw error;}
        return operation();
      });
      return {
        get:key => request(() => structuredClone(this.values.get(key))),
        getAll:() => request(() => structuredClone([...this.values.values()])),
        add:value => writing(() => {
          if (this.values.has(value.id)) {const e=new Error('Duplicate key');e.name='ConstraintError';throw e;}
          this.values.set(value.id,structuredClone(value));return value.id;
        }),
        put:value => writing(() => {this.values.set(value.id,structuredClone(value));return value.id;}),
        delete:key => writing(() => {this.values.delete(key);})
      };
    }
    drain() {
      if (this.done) return;
      const next=this.pending.shift();
      if (!next) {
        this.done=true;
        if (this.mode==='readwrite') db.records=this.values;
        this.oncomplete?.();db.active=false;pump();return;
      }
      try {next.req.result=next.operation();next.req.onsuccess?.();}
      catch (error) {this.error=error;this.abort();return;}
      setImmediate(() => this.drain());
    }
    abort() {
      if (this.done) return;
      this.done=true;this.onabort?.();db.active=false;setImmediate(pump);
    }
  }
  return {db, open() {const req={};setImmediate(() => {req.result=db;if(!db.created)req.onupgradeneeded?.();req.onsuccess?.();});return req;}};
}

function harness(withDB=true) {
  const idb=indexedDBFixture();
  const context={window:{},structuredClone,indexedDB:withDB?idb:undefined};
  Object.defineProperty(context,'localStorage',{get(){throw Error('localStorage must not be used');}});
  Object.defineProperty(context,'sessionStorage',{get(){throw Error('sessionStorage must not be used');}});
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../oberon/storage.js'),'utf8'),context,{filename:'oberon/storage.js'});
  return {S:context.window.OberonStorage,idb};
}
const seed=() => ({version:1,folders:['Начало'],notes:[{id:'hello',path:'Начало/Первая.md',content:'# Первая\n\nМысль.',favorite:true,updated:'2026-11-11T08:00:00.000Z'}],active:'hello',tabs:['hello'],collapsed:[],mode:'read',theme:'paper',autoSync:true,syncConflict:null});
const github=(id='vault-one') => ({id,kind:'github',name:'Личные заметки',connection:{owner:'example',repo:'notes',branch:'main',private:true,canWrite:true,repoId:42,htmlUrl:'https://github.com/example/notes'},snapshot:seed(),base:{...seed(),commit:'a'.repeat(40),tree:'b'.repeat(40),entries:{'Начало/Первая.md':{sha:'c'.repeat(40),mode:'100644',type:'blob',size:10}}},dirty:false,lastSync:null,lastOpened:null});
const hasCode=code => error => error?.code===code;

test('one demo is created atomically and repeated opening preserves edits',async()=>{
  const {S}=harness();
  const [first,second]=await Promise.all([S.ensureDemo(seed()),S.ensureDemo(seed())]);
  assert.equal(first.id,'demo');assert.equal(second.id,'demo');assert.equal(first.revision,1);assert.equal(second.revision,1);
  assert.equal((await S.list()).length,1);
  first.snapshot.notes[0].content='Авторская правка демо';
  const saved=await S.save(first,first.revision);
  assert.equal(saved.revision,2);
  const reopened=await S.ensureDemo(seed());
  assert.equal(reopened.snapshot.notes[0].content,'Авторская правка демо');
  assert.equal(reopened.revision,2);
  assert.notEqual(second.snapshot.notes[0].content,'Авторская правка демо');
});

test('concurrent saves with the same revision never overwrite each other',async()=>{
  const {S}=harness();
  const record=await S.create(github());
  const a=structuredClone(record),b=structuredClone(record);
  a.snapshot.notes[0].content='Первая вкладка';b.snapshot.notes[0].content='Вторая вкладка';
  const results=await Promise.allSettled([S.save(a,record.revision),S.save(b,record.revision)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.find(r=>r.status==='rejected').reason.code,'LOCAL_CONFLICT');
  const stored=await S.get(record.id);
  assert.equal(stored.revision,2);assert.equal(stored.snapshot.notes[0].content,'Первая вкладка');
  await assert.rejects(S.save(record),hasCode('LOCAL_CONFLICT'));
});

test('duplicate create and stale deletion are rejected without erasing drafts',async()=>{
  const {S}=harness();const record=await S.create(github());
  await assert.rejects(S.create(github()),hasCode('LOCAL_CONFLICT'));
  record.snapshot.notes[0].content='Сохранённый черновик';
  const saved=await S.save(record,1);
  await assert.rejects(S.remove(record.id,1),hasCode('LOCAL_CONFLICT'));
  assert.equal((await S.get(record.id)).snapshot.notes[0].content,'Сохранённый черновик');
  assert.equal(await S.remove(record.id,saved.revision),true);
  assert.equal(await S.get(record.id),null);
});

test('registry metadata contains counts, never note contents or credentials',async()=>{
  const {S}=harness();const row=github();
  row.connection.token='SECRET_TO_DROP';row.connection.password='ALSO_DROP';
  row.connection.callback=()=>{};row.extra='not a record field';
  row.snapshot.token='DROP_SNAPSHOT_SECRET';row.snapshot.notes[0].content='A note may mention token and password.';
  const stored=await S.create(row);
  assert.equal(stored.connection.token,undefined);assert.equal(stored.connection.password,undefined);
  assert.equal(stored.snapshot.token,undefined);assert.equal(stored.extra,undefined);
  assert.equal(stored.snapshot.notes[0].content,'A note may mention token and password.');
  const [meta]=await S.list();
  assert.equal(meta.noteCount,1);assert.equal(meta.folderCount,1);
  assert.equal(meta.snapshot,undefined);assert.equal(meta.base,undefined);
  assert.ok(!JSON.stringify(meta).includes('A note may mention'));
  await assert.rejects(S.create({...github('unsafe'),token:'DO_NOT_PERSIST'}),hasCode('SECRET_REJECTED'));
  assert.equal(await S.get('unsafe'),null);
});

test('paused conflicts and autosync choice survive reload with sanitized nested snapshots',async()=>{
  const {S}=harness();const row=github();
  row.snapshot.autoSync=false;
  row.snapshot.syncConflict={kind:'remote',token:'DROP_WRAPPER_TOKEN',
    conflicts:[{path:'Начало/Первая.md',base:'База',local:'Локальная версия',remote:'Версия GitHub',password:'DROP_CONFLICT_SECRET'}],
    remote:{...seed(),commit:'d'.repeat(40),tree:'e'.repeat(40),repository:{...row.connection,token:'DROP_REMOTE_TOKEN'},entries:row.base.entries},
    merged:{...seed(),password:'DROP_MERGED_PASSWORD'}};
  const created=await S.create(row),saved=await S.get(created.id);
  assert.equal(saved.snapshot.autoSync,false);
  assert.equal(saved.snapshot.syncConflict.conflicts[0].local,'Локальная версия');
  assert.equal(saved.snapshot.syncConflict.remote.commit,'d'.repeat(40));
  assert.equal(saved.snapshot.syncConflict.remote.repository.owner,'example');
  assert.ok(!JSON.stringify(saved).includes('DROP_'));
  saved.snapshot.syncConflict=null;
  const resolved=await S.save(saved,saved.revision);
  assert.equal(resolved.snapshot.syncConflict,null);
});

test('long repository note IDs, active tab and file paths remain intact',async()=>{
  const {S}=harness();const row=github();
  const filename='Длинная папка/'.repeat(55)+'Заметка.md',id='github:'+filename;
  assert.ok(id.length>300&&id.length<1200);
  row.snapshot.notes=[{id,path:filename,content:'Текст',favorite:false}];
  row.snapshot.active=id;row.snapshot.tabs=[id];row.snapshot.folders=[];
  const saved=await S.create(row);
  assert.equal(saved.snapshot.notes[0].path,filename);
  assert.equal(saved.snapshot.active,id);assert.equal(saved.snapshot.tabs[0],id);
});

test('invalid paths and duplicated note paths cannot replace a valid snapshot',async()=>{
  const {S}=harness();const record=await S.create(github());
  const bad=structuredClone(record);bad.snapshot.notes[0].path='../outside.md';
  await assert.rejects(S.save(bad,record.revision),hasCode('INVALID_DATA'));
  const duplicate=structuredClone(record);duplicate.snapshot.notes.push({...duplicate.snapshot.notes[0],id:'other'});
  await assert.rejects(S.save(duplicate,record.revision),hasCode('INVALID_DATA'));
  assert.equal((await S.get(record.id)).revision,1);
});

test('quota failure rolls back, and an unavailable database is a visible failure',async()=>{
  const {S,idb}=harness();const record=await S.create(github());
  record.snapshot.notes[0].content='Несохранённая правка';idb.db.rejectNextWrite=new DOMException('Fixture write failure','QuotaExceededError');
  await assert.rejects(S.save(record,record.revision),hasCode('STORAGE_QUOTA'));
  const existing=await S.get(record.id);assert.equal(existing.revision,1);assert.notEqual(existing.snapshot.notes[0].content,'Несохранённая правка');
  const unavailable=harness(false);
  await assert.rejects(unavailable.S.list(),hasCode('STORAGE_UNAVAILABLE'));
});

test('demo remains a single fixed project and an empty GitHub vault is valid',async()=>{
  const {S}=harness();const demo=await S.ensureDemo(seed());
  await assert.rejects(S.remove('demo',demo.revision),hasCode('DEMO_REQUIRED'));
  await assert.rejects(S.create({...github('second-demo'),kind:'demo'}),hasCode('INVALID_DATA'));
  const empty=github('empty');empty.snapshot={notes:[],folders:[],active:null,tabs:[]};empty.base=null;
  const saved=await S.create(empty);assert.equal(saved.snapshot.notes.length,0);
  const rows=await S.list();assert.equal(rows.filter(row=>row.kind==='demo').length,1);
});
