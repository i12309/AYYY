// Synthetic events only. Run: node --test tests/health_care.test.cjs
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function modules(){const window={},ctx=vm.createContext({window,crypto:{randomUUID:()=>String(Math.random())}});for(const name of ['model','health-state','care-state'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../health',name+'.js'),'utf8'),ctx);return window;}
const now=new Date('2026-11-10T12:00:00Z'),doc={medications:[{id:'synthetic-med',name:'Synthetic medication',dose:'Planned synthetic dose'}]},intake={medication_id:'synthetic-med',occurred_at:'2026-11-10T11:00:00Z',outcome:'taken',dose:'',notes:''};
const reminder={title:'Synthetic reminder',medication_id:'',date:'2026-11-10',time:'14:00',timezone:'Europe/Moscow',frequency:'once',until_date:'',utc_offset:'',notes:'',enabled:true};
test('intakes preserve unknown dose, source and deleted medication names, rejecting future events and new broken links',()=>{
 const C=modules().HumanCare,r=C.checkIntake(intake,{},doc,now);assert.equal(r.dose,'');assert.equal(doc.medications[0].dose,'Planned synthetic dose');
 const changed=C.checkIntake({...intake,notes:'Synthetic correction'},r,{medications:[]},now);assert.equal(changed.medication_name,r.medication_name);assert.equal(changed.source,r.source);assert.equal(changed.version,2);
 assert.throws(()=>C.checkIntake({...intake,occurred_at:'2026-11-11T00:00:00Z'},{},doc,now));assert.throws(()=>C.checkIntake({...intake,outcome:'skipped',dose:'1 unit'},{},doc,now));assert.throws(()=>C.checkIntake(intake,{}, {medications:[]},now));
});
test('reminder actions are due-only, versioned, distinct from intakes and retain the original schedule on snooze',()=>{
 const C=modules().HumanCare,r=C.checkReminder(reminder,{},doc,now);assert.equal(C.due(r,now),true);
 const snoozed=C.act(r,'snooze',{minutes:60,now});assert.equal(snoozed.scheduled_at,r.scheduled_at);assert.equal(snoozed.next_due_at,'2026-11-10T13:00:00.000Z');assert.equal(snoozed.version,2);
 assert.throws(()=>C.act(snoozed,'done',{now}));assert.throws(()=>C.act(r,'snooze',{minutes:30,now}));
 const done=C.act(r,'done',{now});assert.equal(done.enabled,false);assert.equal(done.next_due_at,'');assert.equal(doc.intakes,undefined);
 const daily=C.checkReminder({...reminder,frequency:'daily',date:'2026-11-09'}, {},doc,new Date('2026-11-09T00:00:00Z'));
 const advanced=C.act(daily,'skipped',{now});assert.equal(advanced.next_due_at,'2026-11-11T11:00:00.000Z');assert.equal(advanced.enabled,true);
});
test('daily schedules skip nonexistent times and use only the earlier repeated time; once requires a matching offset',()=>{
 const C=modules().HumanCare,base={...reminder,frequency:'daily',date:'2026-03-07',time:'02:30',timezone:'America/New_York'};
 assert.equal(C.checkReminder(base,{},doc,new Date('2026-03-08T00:00:00Z')).next_due_at,'2026-03-09T06:30:00.000Z');
 const fold={...base,date:'2026-10-31',time:'01:30'};
 assert.equal(C.checkReminder(fold,{},doc,new Date('2026-11-01T00:00:00Z')).next_due_at,'2026-11-01T05:30:00.000Z');
 assert.equal(C.checkReminder(fold,{},doc,new Date('2026-11-01T05:45:00Z')).next_due_at,'2026-11-02T06:30:00.000Z');
 const once={...fold,frequency:'once',date:'2026-11-01'};assert.throws(()=>C.checkReminder(once,{},doc,now));
 assert.equal(C.checkReminder({...once,utc_offset:'-05:00'}, {},doc,now).next_due_at,'2026-11-01T06:30:00.000Z');assert.throws(()=>C.checkReminder({...once,utc_offset:'+03:00'}, {},doc,now));
 assert.throws(()=>C.checkReminder({...base,frequency:'once',date:'2026-03-08',utc_offset:'-05:00'}, {},doc,now));
 assert.throws(()=>C.checkReminder({...base,until_date:'2026-03-07'}, {},doc,now));
});
test('legacy care records hydrate without rewriting source, overrides and deletions do not resurrect',()=>{
 const C=modules().HumanCare,raw={id:'synthetic-event',...intake,medication_name:'Original synthetic medication',version:1},d={humanMigration:{tables:{care_records:[{id:raw.id,kind:'intake',version:1,deleted:0,payload:JSON.stringify(raw)}]}}};
 assert.equal(C.records(d,'intake')[0].medication_name,raw.medication_name);d.intakes=[{...raw,notes:'Correction',version:2}];assert.equal(C.records(d,'intake').length,1);assert.equal(C.records(d,'intake')[0].notes,'Correction');d.careDeletions=[raw.id];assert.equal(C.records(d,'intake').length,0);assert.equal(JSON.parse(d.humanMigration.tables.care_records[0].payload).notes,'');
});
