/* Regression tests for first-time HUMAN GitHub storage (no live token). */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createHash,webcrypto}=require('node:crypto');
const transport=fs.readFileSync(path.join(__dirname,'..','health','github.js'),'utf8');
const SHA=value=>value.repeat(40);
const repo={owner:'example',repo:'private-health',branch:'main'};

function backend({initialized=false,otherBranch=false,denyWrite=false}={}){
  let head=initialized?SHA('a'):null;
  let vault=null;
  let nextTree=[];
  const calls=[];
  const blobs=new Map();
  const apiRoot='/repos/example/private-health';
  function reply(status,data){
    return {status,ok:status>=200&&status<300,headers:{get:()=>null},
      json:async()=>data};
  }
  async function fetch(url,options={}){
    const method=options.method||'GET',request=new URL(url);
    const endpoint=request.pathname;
    const body=options.body?JSON.parse(options.body):null;
    calls.push({method,endpoint,body});
    if(endpoint===apiRoot&&method==='GET')
      return reply(200,{id:17,private:true,visibility:'private'});
    if(endpoint===apiRoot+'/git/ref/heads/main'&&method==='GET')
      return head?reply(200,{object:{sha:head}}):reply(404,{message:'Not Found'});
    if(endpoint===apiRoot+'/branches'&&method==='GET')
      return reply(200,head?[{name:'main'}]:otherBranch?[{name:'other'}]:[]);
    if(endpoint===apiRoot+'/contents/health-data/v2/.gitkeep'&&method==='PUT'){
      if(denyWrite)return reply(403,{message:'Resource not accessible by personal access token'});
      if(head)return reply(422,{message:'branch was initialized elsewhere'});
      assert.equal(body.branch,'main');
      head=SHA('1');
      return reply(201,{content:{path:'health-data/v2/.gitkeep',sha:SHA('f')},commit:{sha:head}});
    }
    if(endpoint===apiRoot+'/contents/health-data/v2/vault.json'&&method==='GET'){
      if(!vault)return reply(404,{message:'Not Found'});
      return reply(200,{type:'file',sha:vault.sha,size:vault.bytes.length,
        encoding:'base64',content:vault.bytes.toString('base64')});
    }
    if(endpoint===apiRoot+'/git/blobs'&&method==='POST'){
      if(denyWrite)return reply(403,{message:'Resource not accessible'});
      const bytes=Buffer.from(body.content,'base64');
      const sha=createHash('sha1').update(Buffer.from('blob '+bytes.length+'\\0')).update(bytes).digest('hex');
      blobs.set(sha,bytes);
      return reply(201,{sha});
    }
    if(endpoint.startsWith(apiRoot+'/git/commits/')&&method==='GET')
      return reply(200,{tree:{sha:SHA('2')}});
    if(endpoint===apiRoot+'/git/trees'&&method==='POST'){
      nextTree=body.tree;
      return reply(201,{sha:SHA('3')});
    }
    if(endpoint===apiRoot+'/git/commits'&&method==='POST')
      return reply(201,{sha:SHA('4')});
    if(endpoint===apiRoot+'/git/refs/heads/main'&&method==='PATCH'){
      head=body.sha;
      const entry=nextTree.find(item=>item.path==='health-data/v2/vault.json');
      assert.ok(entry);
      vault={sha:entry.sha,bytes:blobs.get(entry.sha)};
      return reply(200,{object:{sha:head}});
    }
    throw Error('Unexpected request: '+method+' '+request.pathname+request.search);
  }
  const window={HumanCrypto:{MAX_METADATA:1024*1024,MAX_OBJECTS:1000,
    assertEnvelope:()=>true,
    base64:bytes=>Buffer.from(bytes).toString('base64'),
    unbase64:data=>new Uint8Array(Buffer.from(data,'base64'))}};
  vm.runInNewContext(transport,{window,fetch,crypto:webcrypto,TextEncoder,TextDecoder,AbortController});
  const G=window.HumanGithub;
  G.token('synthetic-token-not-valid-on-github');
  return {G,calls};
}
const envelope={format:'test-encrypted-vault',objectIds:[],vaultId:'only-a-synthetic-id'};

test('repository with other files but no HUMAN vault accepts a first encrypted journal',async()=>{
  const {G,calls}=backend({initialized:true});
  assert.equal(await G.verify(repo),true);
  assert.equal(await G.read(repo),null);
  const sha=await G.write(repo,envelope,null);
  assert.match(sha,/^[a-f0-9]{40}$/);
  const restored=await G.read(repo);
  assert.equal(restored.sha,sha);
  assert.equal(restored.envelope.vaultId,envelope.vaultId);
  assert.equal(calls.filter(x=>x.method==='PUT').length,0);
  assert.equal(calls.filter(x=>x.method==='PATCH').length,1);
});

test('completely empty repository receives a first commit and an encrypted HUMAN vault',async()=>{
  const {G,calls}=backend();
  assert.equal(await G.verify(repo),true);
  assert.equal(await G.read(repo),null);
  await G.write(repo,envelope,null);
  assert.equal(calls.filter(x=>x.method==='PUT').length,1);
  assert.equal(calls.filter(x=>x.method==='PATCH').length,1);
  assert.equal((await G.read(repo)).envelope.vaultId,envelope.vaultId);
  const writes=calls.filter(x=>x.method==='PATCH').length;
  await assert.rejects(()=>G.write(repo,envelope,null),/Конфликт/);
  assert.equal(calls.filter(x=>x.method==='PATCH').length,writes);
});

test('missing requested branch in an initialized repository is not treated as empty',async()=>{
  const {G,calls}=backend({otherBranch:true});
  await assert.rejects(()=>G.verify(repo),/Ветка.*main.*не найдена/);
  assert.equal(calls.filter(x=>x.method==='PUT').length,0);
});

test('read-only token cannot initialize a repository and does not report success',async()=>{
  const {G,calls}=backend({denyWrite:true});
  await assert.rejects(()=>G.write(repo,envelope,null),/Нет доступа к GitHub/);
  assert.equal(calls.filter(x=>x.method==='PATCH').length,0);
});
