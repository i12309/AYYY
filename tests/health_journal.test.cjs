// Synthetic profile, action chronology and current-format encryption contracts.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{webcrypto}=require('node:crypto');
function modules(){const window={},ctx=vm.createContext({window,crypto:webcrypto,isSecureContext:true,TextEncoder,TextDecoder,Uint8Array,btoa,atob});for(const name of ['crypto','model','health-state','journal-state'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../health',name+'.js'),'utf8'),ctx);return window;}
const fixture=()=>({profile:{name:'Synthetic profile',timezone:'Europe/Moscow'},observations:[],vitals:[],episodes:[],medical:[],medications:[],findings:[],diary:[],documents:[],intakes:[],reminders:[],revisions:[],timeline:[],recommendationIntakes:[],recommendationContexts:[],recommendationReports:[]});

test('profile calendar age and height preserve unknowns and use the profile zone',()=>{
 const J=modules().HumanJournal,now=new Date('2026-11-10T00:30:00Z');
 assert.equal(J.ageOn('', '2026-11-10'),null);assert.equal(J.ageOn('2026-11-11','2026-11-10'),null);assert.equal(J.ageOn('2006-11-11','2026-11-10'),19);assert.equal(J.ageOn('2006-11-10','2026-11-10'),20);assert.equal(J.ageOn('2000-02-29','2025-02-28'),24);assert.equal(J.ageOn('2000-02-29','2025-03-01'),25);
 assert.equal(J.profileDay({timezone:'America/Los_Angeles'},now),'2026-11-09');
 const p=J.checkProfile({name:' Synthetic person ',timezone:'Europe/Moscow',birthDate:'2000-02-29',heightCm:'170,5'},{},now);assert.equal(p.heightCm,170.5);assert.equal(p.name,'Synthetic person');assert.equal(p.sex,'unknown');
 assert.equal(J.checkProfile({name:p.name,timezone:p.timezone,birthDate:''},p,now).heightCm,170.5);assert.equal(J.checkProfile({...p,heightCm:''},p,now).heightCm,null);
 for(const value of [{name:''},{timezone:'invalid/zone'},{birthDate:'2026-11-11'},{birthDate:'1849-12-31'},{birthDate:'2001-02-29'},{heightCm:'0'},{heightCm:'301'},{heightCm:'NaN'},{sex:'invalid'},{notes:'a'.repeat(3001)}])assert.throws(()=>J.checkProfile({...p,...value},{},now));
});

test('timeline records action time, correction and deletion without rewriting the event date',()=>{
 const J=modules().HumanJournal,before=fixture(),after=structuredClone(before),at=new Date('2026-11-10T11:00:00Z');after.observations.push({id:'synthetic-lab',name:'Synthetic test',date:'2020-01',datePrecision:'month',value:'7'});
 const [create]=J.appendChanges(before,after,at);assert.equal(create.kind,'observation');assert.equal(create.happenedAt,at.toISOString());assert.equal(after.observations[0].date,'2020-01');assert.equal(J.findRecord(after,create).value,'7');
 const corrected=structuredClone(after);corrected.observations[0].value='8';J.appendChanges(after,corrected,new Date('2026-11-10T12:00:00Z'));assert.equal(J.events(corrected)[0].kind,'observation_revision');assert.equal(after.observations[0].value,'7');
 const deleted=structuredClone(corrected);deleted.observations=[];J.appendChanges(corrected,deleted,new Date('2026-11-10T13:00:00Z'));assert.equal(J.events(deleted).length,1);assert.equal(J.events(deleted)[0].kind,'observation_deleted');assert.equal(J.findRecord(deleted,J.events(deleted)[0]),null);assert.equal(deleted.timeline.length,3);
});

test('reminder completion remains a reminder and import yields one batch event',()=>{
 const J=modules().HumanJournal,before=fixture(),after=structuredClone(before);before.reminders.push({id:'synthetic-reminder',title:'Synthetic reminder',version:1});after.reminders.push({...before.reminders[0],version:2,last_action:'done'});after.revisions.push({recordId:'synthetic-reminder',operation:'done'});
 let changes=J.appendChanges(before,after);assert.equal(changes[0].kind,'care_reminder');assert.match(changes[0].title,/Выполнено напоминание/);assert.equal(after.intakes.length,0);
 const imported=structuredClone(after);for(let i=0;i<2;i++)imported.observations.push({id:'synthetic-import-'+i,name:'Synthetic imported test',provenance:{filename:'synthetic.csv'},documentId:'synthetic-document'});
 changes=J.appendChanges(after,imported);assert.equal(changes.filter(e=>e.kind==='import').length,1);assert.equal(changes.filter(e=>e.kind==='observation').length,2);assert.equal(J.events(imported,{kind:'import',query:'synthetic.csv'}).length,1);assert.equal(J.events(imported,{query:'missing'}).length,0);
});

test('saving the profile logs an action even when all field values stay the same',()=>{
 const J=modules().HumanJournal,before=fixture(),after=structuredClone(before);after.revisions.push({kind:'profile',operation:'edit'});const events=J.appendChanges(before,after);assert.equal(events.length,1);assert.equal(events[0].kind,'profile');assert.equal(J.findRecord(after,events[0]),after.profile);
});

test('rekey preserves current records and attachments and rejects the old phrase',async()=>{
 const C=modules().HumanCrypto,{doc,key,envelope}=await C.create('synthetic-original-phrase');
 const bytes=new TextEncoder().encode('Synthetic attachment');
 const original=await C.sealFile(doc.id,'synthetic-doc',bytes,key);
 doc.profile.name='Synthetic person';
 const file={id:'synthetic-doc',name:'synthetic.txt',...original.reference};
 doc.documents.push(file);
 const saved=await C.seal(doc,key,envelope);
 const rotated=await C.newKey('synthetic-new-passphrase');
 const rotatedFile=await C.sealFile(doc.id,file.id,bytes,rotated.key);
 Object.assign(file,rotatedFile.reference);
 const next=await C.seal(doc,rotated.key,rotated);
 assert.equal(next.vaultId,doc.id);
 assert.notEqual(next.salt,saved.salt);
 assert.notEqual(next.iv,saved.iv);
 assert.notEqual(original.object.id,rotatedFile.object.id);
 assert.equal(rotated.key.extractable,false);
 assert.equal(JSON.stringify((await C.unlock(next,'synthetic-new-passphrase')).doc),JSON.stringify(doc));
 assert.deepEqual(await C.openFile(doc.id,file,rotatedFile.object,rotated.key),bytes);
 await assert.rejects(C.unlock(next,'synthetic-original-phrase'));
 await assert.rejects(C.openFile(doc.id,file,rotatedFile.object,key));
 await assert.rejects(C.newKey('short'));
 const incomplete=structuredClone(doc);delete incomplete.timeline;assert.throws(()=>C.assertData(incomplete));assert.equal(Object.hasOwn(incomplete,'timeline'),false);
});

test('attachment bytes, record identity and the manifest are authenticated independently',async()=>{
 const C=modules().HumanCrypto,{doc,key,envelope}=await C.create('synthetic-original-phrase');
 const bytes=new TextEncoder().encode('Synthetic attachment');
 const {reference,object}=await C.sealFile(doc.id,'attachment-a',bytes,key);
 const file={id:'attachment-a',...reference};
 doc.documents.push(file);
 const sealed=await C.seal(doc,key,envelope);
 assert.deepEqual([...sealed.objectIds],[object.id]);
 assert.deepEqual(await C.openFile(doc.id,file,object,key),bytes);
 await assert.rejects(C.openFile(doc.id,{...file,id:'attachment-b'},object,key));
 await assert.rejects(C.openFile(doc.id,{...file,sha256:'0'.repeat(64)},object,key));
 const modified=object.bytes.slice();
 modified[modified.length-1]^=1;
 await assert.rejects(C.openFile(doc.id,file,{...object,bytes:modified},key));
 await assert.rejects(C.openWithKey({...sealed,objectIds:[]},key));
 await assert.rejects(C.seal({...doc,documents:[{...file,size:C.MAX_FILE+1}]},key,envelope));
});
