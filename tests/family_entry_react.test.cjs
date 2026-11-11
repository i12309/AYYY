/* The GEN entry must have one module identity across lazy chunks. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const family=path.join(__dirname,'..','family');

test('GEN entry has no query/hash, so React is not instantiated twice',()=>{
  const html=fs.readFileSync(path.join(family,'index.html'),'utf8');
  const scripts=[...html.matchAll(/<script\b[^>]*type=["']module["'][^>]*src=["']([^"']+)["']/g)]
    .map(match=>match[1]);
  assert.equal(scripts.length,1,'exactly one app module script must load');
  const entry=scripts[0];
  assert.match(entry,/^\.\/assets\/index-[A-Za-z0-9_-]+\.js$/);
  assert.ok(!/[?#]/.test(entry),'query strings make the same module a different instance');

  const entryName=path.basename(entry);
  const assets=path.join(family,'assets');
  assert.ok(fs.existsSync(path.join(assets,entryName)));
  const dynamicChunks=fs.readdirSync(assets).filter(name=>name.endsWith('.js')&&name!==entryName);
  const importsEntry=dynamicChunks.filter(name=>
    fs.readFileSync(path.join(assets,name),'utf8').includes('./'+entryName));
  assert.ok(importsEntry.length>0,'lazy chunks must import exactly the same entry URL');
});
