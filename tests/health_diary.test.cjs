// Synthetic nutrition/activity contracts and day history.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{webcrypto}=require('node:crypto');
function modules(){const window={},ctx=vm.createContext({window,crypto:webcrypto,TextEncoder});for(const name of ['model','health-state','diary-state'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../health',name+'.js'),'utf8'),ctx);return window;}
const doc=()=>({profile:{timezone:'Europe/Moscow'},diary:[],revisions:[]});
test('meal summary distinguishes no data, explicit zero and partial known totals',()=>{
 const D=modules().HumanDiary,d=doc();d.diary.push(D.checkMeal({description:'Synthetic first meal',eaten_at:'2026-11-10T08:00:00Z',calories_kcal:'0',protein_g:'',fat_g:'10,5',estimated:true},{},d));d.diary.push(D.checkMeal({description:'Synthetic second meal',eaten_at:'2026-11-10T09:00:00Z',calories_kcal:'200',protein_g:'10'},{},d));
 const s=D.summary(d,'2026-11-10');assert.equal(s.count,2);assert.equal(s.calories_kcal.value,200);assert.equal(s.calories_kcal.known,2);assert.equal(s.protein_g.known,1);assert.equal(s.fat_g.value,10.5);assert.equal(s.alcohol_g.value,null);assert.equal(s.alcohol_g.known,0);assert.equal(s.estimated,1);assert.equal(D.summary(d,'2026-11-11').calories_kcal.value,null);
});
test('meal calendar filtering respects the profile zone and DST day boundaries',()=>{
 const D=modules().HumanDiary,d=doc();d.profile.timezone='America/New_York';
 for(const at of ['2026-03-08T04:59:59Z','2026-03-08T05:00:00Z','2026-03-09T03:59:59Z','2026-03-09T04:00:00Z'])d.diary.push(D.checkMeal({description:'Synthetic boundary meal',eaten_at:at},{},d));
 assert.equal(D.summary(d,'2026-03-08').count,2);assert.equal(D.summary(d,'2026-03-07').count,1);assert.equal(D.summary(d,'2026-03-09').count,1);
 assert.throws(()=>D.checkMeal({description:'Synthetic fold',at:'2026-11-01T01:30'},{},d));
 const r=D.checkMeal({description:'Synthetic fold',at:'2026-11-01T01:30',offset:'-05:00'},{},d);assert.equal(r.eaten_at,'2026-11-01T06:30:00.000Z');
});
test('corrections preserve exact timestamp and prior facts while clearing known numbers',()=>{
 const D=modules().HumanDiary,d=doc(),original=D.checkMeal({description:'Synthetic current meal',eaten_at:'2026-11-10T09:00:00.123456789Z',protein_g:'12'},{},d);d.diary.push(original);
 const changed=D.checkMeal({description:original.description,at:'2026-11-10T12:00',protein_g:'',notes:'Synthetic correction'},original,d);d.diary[0]=changed;
 assert.equal(changed.eaten_at,original.eaten_at);assert.equal(D.records(d,'meal')[0].protein_g,null);assert.equal(original.protein_g,12);assert.equal(changed.version,2);
 assert.throws(()=>D.checkMeal({description:'Synthetic missing time'},{},d));
});
test('activity keeps one daily entry and validates integers and unknowns',()=>{
 const D=modules().HumanDiary,d=doc(),r=D.checkActivity({date:'2026-11-10',steps:'0',sleep_minutes:'450',exercise_minutes:''},{},d);d.diary.push(r);
 assert.equal(r.steps,0);assert.equal(r.sleep_minutes,450);assert.equal(r.exercise_minutes,null);assert.equal(D.duration(r.sleep_minutes),'7 ч 30 мин');assert.throws(()=>D.checkActivity({date:r.date,steps:'1'},{},d));assert.throws(()=>D.checkActivity({date:r.date,steps:'1.5'},r,d));assert.throws(()=>D.checkActivity({date:r.date,sleep_minutes:'1441'},r,d));assert.throws(()=>D.checkActivity({date:r.date},r,d));
 const cleared=D.checkActivity({date:r.date,notes:'Synthetic day note'},r,d);assert.equal(cleared.steps,null);assert.equal(cleared.version,2);
});
test('explicit day recreation retains its correction history and increments version',()=>{
 const D=modules().HumanDiary,d=doc(),before=D.checkActivity({date:'2026-11-10',steps:'100'},{},d);d.revisions.push({operation:'delete',previous:before});assert.equal(D.records(d,'activity-day').length,0);
 const recreated=D.checkActivity({date:before.date,steps:'200'},{},d);assert.equal(recreated.id,before.id);assert.equal(recreated.version,2);assert.equal(recreated.origin.type,'manual');
});
