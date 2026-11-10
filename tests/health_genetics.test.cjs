// Synthetic report entries only. No clinical interpretation fixtures.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function model(){const window={},context=vm.createContext({window,URL,crypto:{randomUUID:()=>String(Math.random())}});for(const file of ['model','genetics-state'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../health',file+'.js'),'utf8'),context);return window.HumanGenetics;}
const doc={documents:[{id:'synthetic-doc'}]},base={title:'Synthetic reported finding',result:'  Synthetic original result\nNo interpretation supplied.  ',provider:'Synthetic provider',category:'other',status:'unknown',date_precision:'unknown',genes:'demoGene; DEMO2',variants:'SYNTHETIC:./.\nassembly unknown; strand unknown',provider_text:'Original synthetic provider explanation'};
test('reported text, genes and no-call are preserved without inferred fields',()=>{
 const G=model(),r=G.checkFinding(base,{},doc);assert.equal(r.result,base.result);assert.equal(r.variants,base.variants);assert.deepEqual(Array.from(r.genes),['demoGene','DEMO2']);assert.equal(r.status,'unknown');assert.equal(r.test_date,'');assert.equal(r.date_precision,'unknown');assert.equal(r.review_status,'confirmed_manual');assert.equal(r.interpretation,undefined);assert.equal(r.risk,undefined);assert.equal(r.assembly,undefined);
});
test('partial study dates retain their precision and reject missing or impossible dates',()=>{
 const G=model();for(const [date,precision] of [['2024','year'],['2024-02','month'],['2024-02-29','day']]){const r=G.checkFinding({...base,test_date:date,date_precision:precision},{},doc);assert.equal(r.test_date,date);assert.equal(r.date_precision,precision);}
 for(const [date,precision] of [['2024','unknown'],['','day'],['2023-02-29','day'],['2024-13','month'],['2024-01-01','year']])assert.throws(()=>G.checkFinding({...base,test_date:date,date_precision:precision},{},doc));
});
test('only safe explicit source URLs and profile-owned documents can be attached',()=>{
 const G=model(),r=G.checkFinding({...base,source_url:'https://example.org/synthetic?q=report',source_document_id:'synthetic-doc',method_version:'Synthetic method v1'},{},doc);assert.equal(r.source.url,r.source_url);assert.equal(r.source.document_id,'synthetic-doc');assert.equal(r.source.method_version,r.method_version);
 for(const url of ['javascript:alert(1)','data:text/html,test','file:///synthetic','https://name:password@example.org','//example.org','https://']){assert.throws(()=>G.checkFinding({...base,source_url:url},{},doc));assert.equal(G.safeURL(url),'');}
 assert.throws(()=>G.checkFinding({...base,source_document_id:'not-this-profile'},{},doc));
 const corrected=G.checkFinding({result:'Corrected synthetic report'},r,{documents:[]});assert.equal(corrected.source_document_id,r.source_document_id);assert.equal(corrected.version,2);assert.equal(r.result,base.result);
});
test('content limits reject without truncation; statuses cannot turn into a clinical conclusion',()=>{
 const G=model();for(const input of [{title:'x'.repeat(301)},{result:'x'.repeat(16001)},{provider_text:'x'.repeat(64001)},{variants:'x'.repeat(16001)},{title:''},{result:'\n '},{status:'normal'},{category:'inferred'},{review_status:'automatic_diagnosis'}])assert.throws(()=>G.checkFinding({...base,...input},{},doc));
 const r=G.checkFinding({...base,status:'attention',review_status:'draft'},{},doc);assert.equal(r.status,'attention');assert.equal(r.review_status,'draft');assert.equal(r.result,base.result);
});
test('cards search by reported title/provider and filter categories without rewriting entries',()=>{
 const G=model(),a=G.checkFinding(base,{},doc,new Date('2026-11-01T00:00:00Z')),b=G.checkFinding({...base,title:'Synthetic nutrition entry',provider:'Other lab',category:'nutrition'},{},doc,new Date('2026-11-02T00:00:00Z')),d={findings:[a,b]};
 assert.equal(G.records(d)[0].id,b.id);assert.equal(G.records(d,{query:'other LAB'})[0].id,b.id);assert.equal(G.records(d,{category:'nutrition'}).length,1);assert.equal(G.records(d,{query:'demoGene'}).length,0);assert.equal(d.findings[0],a);
});
