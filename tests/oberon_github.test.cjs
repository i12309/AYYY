// No credentials or network needed: node --test tests/oberon_github.test.cjs
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const {TextEncoder,TextDecoder}=require('node:util');
const source=fs.readFileSync(path.join(__dirname,'../oberon/github.js'),'utf8');
const sha=value=>crypto.createHash('sha1').update(value).digest('hex');
const clone=value=>JSON.parse(JSON.stringify(value));
const gitBlob=bytes=>sha(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes]));
const note=(path,content,id=path)=>({id,path,content,favorite:false,updated:null});
const snapshot=(notes=[],folders=[])=>({notes,folders,entries:{}});

class GitMock {
  constructor(files={},options={}) {
    this.options=options;this.calls=[];this.blobs=new Map();this.trees=new Map();this.commits=new Map();this.sequence=0;this.headReads=0;
    this.repo={id:103,private:true,default_branch:'main',permissions:{push:true}};
    this.install(files);
  }
  files(input) {
    const result={};
    for(const [p,value] of Object.entries(input)){
      const object=typeof value==='string'?{content:value}:value;
      const bytes=Buffer.isBuffer(object.content)?object.content:Buffer.from(object.content||'');
      const id=object.sha||gitBlob(bytes);
      this.blobs.set(id,{sha:id,encoding:'base64',content:bytes.toString('base64'),size:bytes.length});
      result[p]={sha:id,mode:object.mode||'100644',type:object.type||'blob',size:bytes.length};
    }
    return result;
  }
  buildTree(files) {
    const recurse=(prefix='')=>{
      const immediate=new Map();
      for(const [full,entry]of Object.entries(files)) {
        if(prefix&&!full.startsWith(prefix+'/'))continue;
        const relative=prefix?full.slice(prefix.length+1):full;
        const name=relative.split('/')[0];
        if(relative.includes('/'))immediate.set(name,{type:'tree',mode:'040000'});
        else immediate.set(name,{...entry});
      }
      const tree=[],recursive=[];
      for(const [p,entry]of [...immediate].sort(([a],[b])=>a.localeCompare(b))) {
        if(entry.type==='tree'){
          const sub=recurse(prefix?prefix+'/'+p:p),item={path:p,mode:'040000',type:'tree',sha:sub.sha};
          tree.push(item);recursive.push(item,...sub.recursive.map(x=>({...x,path:p+'/'+x.path})));
        }else{const item={path:p,...entry};tree.push(item);recursive.push(item);}
      }
      const id=sha(JSON.stringify(tree));
      const relativeFiles=Object.fromEntries(Object.entries(files).filter(([p])=>!prefix||p.startsWith(prefix+'/')).map(([p,v])=>[prefix?p.slice(prefix.length+1):p,{...v}]));
      const value={sha:id,tree,recursive,files:relativeFiles};this.trees.set(id,value);return value;
    };
    return recurse();
  }
  install(files) {
    const tree=this.buildTree(this.files(files));
    const id=sha('commit'+(++this.sequence)+tree.sha);
    this.commits.set(id,{sha:id,tree:{sha:tree.sha},parents:[],committer:{date:'2026-11-11T10:00:00Z'}});
    this.current=id;return id;
  }
  currentFiles(){return this.trees.get(this.commits.get(this.current).tree.sha).files;}
  currentText(file){const blob=this.blobs.get(this.currentFiles()[file]?.sha);return blob?Buffer.from(blob.content,'base64').toString('utf8'):null;}
  response(status,body,headers={}){return {ok:status>=200&&status<300,status,headers:{get:key=>headers[key]??null},json:async()=>clone(body)};}
  async fetch(url,opts={}){
    const parsed=new URL(url),method=opts.method||'GET',pathname=decodeURIComponent(parsed.pathname.replace('/repos/user/notes',''));
    const body=opts.body?JSON.parse(opts.body):undefined;
    this.calls.push({url,method,path:pathname,body,headers:opts.headers});
    if(this.options.reply)return this.options.reply({url,method,pathname,body,opts},this);
    assert.equal(parsed.origin,'https://api.github.com');assert.match(parsed.pathname,/^\/repos\/user\/notes(?:\/|$)/);
    assert.equal(opts.credentials,'omit');assert.equal(opts.redirect,'error');
    if(opts.signal?.aborted)throw new Error('aborted');
    if(pathname===''&&method==='GET')return this.response(200,this.repo);
    if(pathname.startsWith('/git/ref/heads/')&&method==='GET'){
      this.headReads++;
      if(this.options.beforeHead)this.options.beforeHead(this);
      return this.response(200,{object:{type:'commit',sha:this.current}});
    }
    if(pathname.startsWith('/git/commits/')&&method==='GET'){
      const c=this.commits.get(pathname.split('/').pop());return this.response(c?200:404,c||{});
    }
    if(pathname.startsWith('/git/trees/')&&method==='GET'){
      const t=this.trees.get(pathname.split('/').pop());if(!t)return this.response(404,{});
      return this.response(200,{sha:t.sha,tree:parsed.searchParams.has('recursive')?t.recursive:t.tree,truncated:!!this.options.truncated});
    }
    if(pathname.startsWith('/git/blobs/')&&method==='GET'){
      const b=this.blobs.get(pathname.split('/').pop());return this.response(b?200:404,b||{});
    }
    if(pathname==='/git/blobs'&&method==='POST'){
      const bytes=Buffer.from(body.content,body.encoding==='base64'?'base64':'utf8'),id=gitBlob(bytes);
      this.blobs.set(id,{sha:id,encoding:'base64',content:bytes.toString('base64'),size:bytes.length});return this.response(201,{sha:id});
    }
    if(pathname==='/git/trees'&&method==='POST'){
      assert.ok(body.base_tree,'writes must preserve the entire existing repository');
      const tree=this.trees.get(body.base_tree);assert.ok(tree);
      const files=clone(tree.files);
      for(const entry of body.tree){
        assert.ok(entry.path.startsWith('OBERON/'),'write escaped OBERON root');
        if(entry.sha===null){assert.ok(files[entry.path]);delete files[entry.path];}
        else files[entry.path]={sha:entry.sha,mode:entry.mode,type:entry.type,size:this.blobs.get(entry.sha).size};
      }
      const result=this.buildTree(files);return this.response(201,{sha:result.sha});
    }
    if(pathname==='/git/commits'&&method==='POST'){
      assert.match(body.message,/\[skip ci\]/);
      const id=sha(JSON.stringify(body)+ ++this.sequence);
      this.commits.set(id,{sha:id,tree:{sha:body.tree},parents:body.parents,committer:{date:'2026-11-11T11:00:00Z'}});
      return this.response(201,{sha:id});
    }
    if(pathname.startsWith('/git/refs/heads/')&&method==='PATCH'){
      assert.equal(body.force,false);
      if(this.options.refRace){this.options.refRace(this);return this.response(422,{message:'Not a fast-forward'});}
      const commit=this.commits.get(body.sha);assert.ok(commit);
      if(commit.parents[0]!==this.current)return this.response(422,{message:'Not a fast-forward'});
      this.current=body.sha;return this.response(200,{object:{sha:this.current}});
    }
    throw new Error('Unexpected mocked endpoint: '+method+' '+pathname);
  }
}
function moduleFor(mock){
  const window={};
  const context=vm.createContext({window,TextEncoder,TextDecoder,AbortController,crypto:crypto.webcrypto,
    fetch:mock.fetch.bind(mock),btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary'),
    get localStorage(){throw Error('Token/storage boundary violated');},get sessionStorage(){throw Error('Token/storage boundary violated');}});
  vm.runInContext(source,context,{filename:'oberon/github.js'});return window.OberonGitHub;
}
function setup(files={},token='test-token',options={}){const mock=new GitMock(files,options),api=moduleFor(mock),client=api.create({owner:'user',repo:'notes',branch:''},token);return {mock,api,client};}
const writes=mock=>mock.calls.filter(call=>call.method!=='GET');

test('repository parser accepts explicit GitHub paths and rejects unsafe refs/hosts',()=>{
  const {api}=setup();
  assert.deepEqual(clone(api.parseRepo('https://github.com/user/notes.git/','work/notes')), {owner:'user',repo:'notes',branch:'work/notes'});
  for(const value of ['https://evil.example/user/notes','user/notes/tree/main','user/../notes'])assert.throws(()=>api.parseRepo(value));
  for(const branch of ['main..bad','../main','main//next','main.lock','@','work/.private','main~1'])assert.throws(()=>api.parseRepo('user/notes',branch));
});

test('three-way merge preserves unrelated remote edits, deletes and empty files',()=>{
  const {api}=setup();
  const base=snapshot([note('a.md','A'),note('b.md','B'),note('empty.md','')],['Old']);
  const local=snapshot([note('a.md','local A','stable-a'),note('b.md','B'),note('new.md','')],['New']);
  const remote=snapshot([note('a.md','A'),note('b.md','remote B'),note('empty.md',''),note('remote.md','added')],['Old','Remote']);
  const result=api.merge(base,local,remote);
  assert.equal(result.conflicts.length,0);
  assert.deepEqual(Object.fromEntries(result.notes.map(n=>[n.path,n.content])),{'a.md':'local A','b.md':'remote B','new.md':'','remote.md':'added'});
  assert.equal(result.notes.find(n=>n.path==='a.md').id,'stable-a');
  assert.deepEqual(clone(result.folders),['New','Remote']);
});

test('three-way conflict distinguishes deletion, addition collision, and identical edits',()=>{
  const {api}=setup();
  const base=snapshot([note('delete.md','before'),note('same.md','before')]);
  const local=snapshot([note('new.md','local'),note('same.md','same')]);
  const remote=snapshot([note('delete.md','remote'),note('new.md','remote'),note('same.md','same')]);
  const merged=api.merge(base,local,remote);
  assert.equal(merged.conflicts.length,2);
  assert.deepEqual(clone(merged.conflicts.find(c=>c.path==='delete.md')),{path:'delete.md',base:'before',local:null,remote:'remote'});
  assert.deepEqual(clone(merged.conflicts.find(c=>c.path==='new.md')),{path:'new.md',base:null,local:'local',remote:'remote'});
  assert.equal(merged.notes.find(n=>n.path==='new.md').content,'local');
  assert.ok(!merged.notes.some(n=>n.path==='delete.md'));
});

test('load confines traversal to OBERON, preserves attachments metadata and caches blobs',async()=>{
  const {client,mock}=setup({'README.md':'repository','health-data/secret.json':'untouched','OBERON/Папка/Заметка.md':'# Мысль\n\nПривет 🌒','OBERON/empty.markdown':'','OBERON/images/map.png':{content:Buffer.from([1,2,3])},'OBERON/link.md':{content:'../README.md',mode:'120000'},'OBERON/Пустая/.gitkeep':''});
  const verified=await client.verify();assert.equal(verified.branch,'main');assert.equal(verified.canWrite,true);assert.equal(verified.repoId,103);
  const first=await client.load();assert.equal(first.notes.length,2);assert.equal(first.notes.find(n=>n.path==='Папка/Заметка.md').content,'# Мысль\n\nПривет 🌒');
  assert.ok(first.entries['images/map.png']);assert.equal(first.entries['link.md'].mode,'120000');assert.ok(first.folders.includes('Пустая'));
  const blobReads=mock.calls.filter(c=>c.method==='GET'&&c.path.startsWith('/git/blobs/')).length;
  await client.load();assert.equal(mock.calls.filter(c=>c.method==='GET'&&c.path.startsWith('/git/blobs/')).length,blobReads);
  assert.equal(writes(mock).length,0);
});

test('a new client reuses verified snapshot text but fetches changed or corrupted blobs',async()=>{
  const files={'OBERON/a.md':'Привет 🌒','OBERON/b.md':'before','OBERON/c.md':'truth'};
  const {api,client,mock}=setup(files);
  const base=await client.load();client.abort();
  const blobReads=()=>mock.calls.filter(c=>c.method==='GET'&&c.path.startsWith('/git/blobs/'));
  const warm=api.create({owner:'user',repo:'notes',branch:'main'},'test-token',base);
  mock.calls.length=0;const unchanged=await warm.load();
  assert.equal(blobReads().length,0,'Unchanged content should survive client recreation without downloading blobs');
  assert.deepEqual(clone(unchanged.notes),clone(base.notes));
  assert.ok(mock.calls.some(c=>c.path===''),'Repository identity must still be checked');
  assert.ok(mock.calls.some(c=>c.path.startsWith('/git/ref/heads/')),'Current branch head must still be checked');
  assert.ok(mock.calls.some(c=>c.path.startsWith('/git/trees/')),'Current tree must still be fetched');
  warm.abort();
  mock.install({...files,'OBERON/b.md':'after'});
  const corrupted=clone(base);corrupted.notes.find(n=>n.path==='c.md').content='false'; // Same byte length, wrong checksum.
  const next=api.create({owner:'user',repo:'notes',branch:'main'},'test-token',corrupted);
  mock.calls.length=0;const refreshed=await next.load();
  assert.equal(blobReads().length,2,'Only the remotely changed and corrupted cached texts need blob downloads');
  const downloaded=new Set(blobReads().map(c=>c.path.split('/').pop()));
  assert.ok(downloaded.has(mock.currentFiles()['OBERON/b.md'].sha));
  assert.ok(downloaded.has(mock.currentFiles()['OBERON/c.md'].sha));
  assert.deepEqual(Object.fromEntries(refreshed.notes.map(n=>[n.path,n.content])),{'a.md':'Привет 🌒','b.md':'after','c.md':'truth'});
  assert.equal(writes(mock).length,0);next.abort();
});

test('public reading has no bearer and writing requires token; abort is final',async()=>{
  const {client,mock}=setup({'OBERON/a.md':'public'},'');mock.repo.private=false;
  const info=await client.verify();assert.equal(info.canWrite,false);
  const base=await client.load();assert.equal(base.notes[0].content,'public');
  assert.ok(mock.calls.every(c=>!c.headers.Authorization));
  await assert.rejects(client.sync({base,local:base}),e=>e.code==='TOKEN_REQUIRED');
  client.abort();const before=mock.calls.length;await assert.rejects(client.load(),e=>e.code==='ABORTED');assert.equal(mock.calls.length,before);
});

test('sync atomically adds, edits and removes notes while retaining unrelated data',async()=>{
  const {client,mock}=setup({'README.md':'keep root','health-data/vault.json':'keep health','OBERON/a.md':'old','OBERON/remove.md':'delete','OBERON/assets/image.png':{content:Buffer.from([5,6,7])},'OBERON/Custom/.gitkeep':'user-defined content','OBERON/Nonempty/.gitkeep':'','OBERON/Nonempty/current.md':'keep'});
  const base=await client.load(),originalOutside=mock.currentFiles()['health-data/vault.json'].sha;
  const local={...clone(base),notes:base.notes.filter(n=>n.path!=='remove.md').map(n=>n.path==='a.md'?{...n,content:'новое 🌒'}:{...n}),folders:[...base.folders,'Empty']};
  local.notes.push(note('New/added.md','# Added'));
  const saved=await client.sync({base,local});
  assert.ok(saved.changed>=4);assert.equal(saved.commit,mock.current);
  assert.equal(mock.currentText('OBERON/a.md'),'новое 🌒');assert.equal(mock.currentText('OBERON/remove.md'),null);assert.equal(mock.currentText('OBERON/New/added.md'),'# Added');
  assert.equal(mock.currentText('README.md'),'keep root');assert.equal(mock.currentFiles()['health-data/vault.json'].sha,originalOutside);
  assert.equal(mock.currentText('OBERON/Custom/.gitkeep'),'user-defined content');assert.equal(mock.currentText('OBERON/Empty/.gitkeep'),'');assert.equal(mock.currentText('OBERON/Nonempty/.gitkeep'),null);
  const commits=writes(mock).filter(c=>c.path==='/git/commits');assert.equal(commits.length,1);assert.deepEqual(commits[0].body.parents,[base.commit]);
  const tree=writes(mock).find(c=>c.path==='/git/trees');assert.equal(tree.body.base_tree,base.tree);assert.ok(tree.body.tree.every(e=>e.path.startsWith('OBERON/')));
  const before=writes(mock).length;const noChanges=await client.sync({base:saved.snapshot,local:saved.snapshot});assert.equal(noChanges.changed,0);assert.equal(writes(mock).length,before);
});

test('sync merges changed local note with unrelated new remote note',async()=>{
  const {client,mock}=setup({'OBERON/a.md':'base A','OBERON/b.md':'base B','outside.txt':'keep'});
  const base=await client.load(),local=clone(base);local.notes.find(n=>n.path==='a.md').content='local A';
  mock.install({'OBERON/a.md':'base A','OBERON/b.md':'remote B','OBERON/remote.md':'remote add','outside.txt':'latest outside'});
  const remoteHead=mock.current,saved=await client.sync({base,local});
  assert.equal(mock.currentText('OBERON/a.md'),'local A');assert.equal(mock.currentText('OBERON/b.md'),'remote B');assert.equal(mock.currentText('OBERON/remote.md'),'remote add');assert.equal(mock.currentText('outside.txt'),'latest outside');
  assert.equal(saved.snapshot.notes.find(n=>n.path==='b.md').content,'remote B');
  const commit=writes(mock).find(c=>c.path==='/git/commits');assert.deepEqual(commit.body.parents,[remoteHead]);
});

test('conflicting changes return reviewable snapshots and perform no writes',async()=>{
  const {client,mock}=setup({'OBERON/a.md':'base'});const base=await client.load(),local=clone(base);local.notes[0].content='ours';
  mock.install({'OBERON/a.md':'theirs'});
  await assert.rejects(client.sync({base,local}),e=>{assert.equal(e.code,'CONFLICT');assert.equal(e.conflicts[0].local,'ours');assert.equal(e.conflicts[0].remote,'theirs');assert.equal(e.remote.notes[0].content,'theirs');assert.equal(e.merged.notes[0].content,'ours');return true;});
  assert.equal(writes(mock).length,0);assert.equal(mock.currentText('OBERON/a.md'),'theirs');
});

test('concurrent head update before ref write is detected without advancing the branch',async()=>{
  const {client,mock}=setup({'OBERON/a.md':'base'});const base=await client.load(),local=clone(base);local.notes[0].content='ours';
  const reads=mock.headReads;mock.options.beforeHead=server=>{if(server.headReads===reads+2)server.install({'OBERON/a.md':'raced'});};
  await assert.rejects(client.sync({base,local}),e=>e.code==='HEAD_CHANGED');
  assert.equal(writes(mock).filter(c=>c.method==='PATCH').length,0);assert.equal(mock.currentText('OBERON/a.md'),'raced');
});

test('race at atomic PATCH is rejected with force false and retains the remote commit',async()=>{
  const {client,mock}=setup({'OBERON/a.md':'base'});const base=await client.load(),local=clone(base);local.notes[0].content='ours';
  mock.options.refRace=server=>server.install({'OBERON/a.md':'race at patch'});
  await assert.rejects(client.sync({base,local}),e=>e.code==='HEAD_CHANGED');
  assert.equal(mock.currentText('OBERON/a.md'),'race at patch');assert.equal(writes(mock).filter(c=>c.method==='PATCH').length,1);
});

test('missing OBERON is an empty vault; non-folder OBERON and symlink collision are rejected',async()=>{
  const {client}=setup({'README.md':'keep'});const empty=await client.load();assert.equal(empty.notes.length,0);assert.equal(empty.folders.length,0);
  const rootCollision=setup({'OBERON':'file'});await assert.rejects(rootCollision.client.load(),e=>e.code==='ROOT_COLLISION');
  const {client:other,mock}=setup({'OBERON/symlink.md':{content:'../outside',mode:'120000'}});const base=await other.load();
  await assert.rejects(other.sync({base,local:snapshot([note('symlink.md','must not overwrite')])}),e=>e.code==='PATH_CONFLICT');assert.equal(writes(mock).length,0);
});

test('truncated trees, binary Markdown, excessive size and duplicate paths stop safely',async()=>{
  const truncated=setup({'OBERON/a.md':'ok'},'token',{truncated:true});await assert.rejects(truncated.client.load(),e=>e.code==='TREE_LIMIT');
  const binary=setup({'OBERON/a.md':{content:Buffer.from([0xff,0xfe,0])}});await assert.rejects(binary.client.load(),e=>e.code==='FILE_FORMAT');
  const large=setup({'OBERON/a.md':'x'.repeat(2*1024*1024+1)});await assert.rejects(large.client.load(),e=>e.code==='FILE_LIMIT');
  const {api}=setup();assert.throws(()=>api.merge(snapshot(),snapshot([note('a.md','1'),note('a.md','2')]),snapshot()),e=>e.code==='INVALID_PATH');
  assert.throws(()=>api.merge(snapshot(),snapshot([note('../outside.md','bad')]),snapshot()),e=>e.code==='INVALID_PATH');
});

test('repository identity and rate limits are enforced without exposing tokens to storage',async()=>{
  const {client,mock}=setup({'OBERON/a.md':'base'});await client.verify();mock.repo.id=104;
  await assert.rejects(client.load(),e=>e.code==='REPOSITORY_CHANGED');
  const rate=setup({},'secret-token',{reply:(request,server)=>server.response(403,{message:'rate limit exceeded'},{'x-ratelimit-remaining':'0','retry-after':'60'})});
  await assert.rejects(rate.client.verify(),e=>e.code==='RATE_LIMIT'&&e.retryAt>Date.now());const requests=rate.mock.calls.length;
  await assert.rejects(rate.client.verify(),e=>e.code==='RATE_LIMIT');assert.equal(rate.mock.calls.length,requests);
  assert.ok(!JSON.stringify(rate.client).includes('secret-token'));
});
