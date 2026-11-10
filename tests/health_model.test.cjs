// Pure Node tests; no GitHub Actions required to run locally.
// Usage: node --test tests/health_model.test.cjs
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const script=name=>fs.readFileSync(path.join(root,name),'utf8');
function model(){
  const w={},ctx={window:w,crypto:{randomUUID:()=>String(Math.random()).slice(2)}};
  vm.runInNewContext(script('health/model.js'),ctx);
  return w.HumanModel;
}
test('all static HUMAN scripts parse',()=>{
  for(const path of ['health/crypto.js','health/store.js','health/github.js',
    'health/model.js','health/view.js','health/app.js','src/health-route.js']){
    assert.doesNotThrow(()=>new vm.Script(script(path)),path);
  }
});
test('measurements group only when type, unit, specimen and method match',()=>{
  const m=model();
  const base={name:'Глюкоза',date:'2026-11-01',value:'5,3',unit:'ммоль/л',
    low:'3,9',high:'5,5',material:'Кровь',method:'А'};
  const a=m.checkLab(base);
  const b=m.checkLab({...base,name:'глюкоза',date:'2026-10-01'});
  const c=m.checkLab({...base,material:'Моча'});
  const d=m.checkLab({...base,unit:'мг/дл'});
  assert.equal(m.groups([a,b,c,d]).length,3);
  assert.equal(m.groups([a,b])[0].rows.length,2);
});
test('reference rules handle zero, partial bounds and qualitative results',()=>{
  const m=model();
  assert.equal(m.status({value:'0',unit:'ммоль/л',low:'1',high:'2'}),'abnormal');
  assert.equal(m.status({value:'2',unit:'ммоль/л',low:'',high:'3'}),'normal');
  assert.equal(m.status({value:'положительно',unit:'ммоль/л',low:'',high:'3'}),'unknown');
  assert.equal(m.status({value:'3',unit:'ммоль/л',low:'',high:''}),'unknown');
  assert.equal(m.status({value:'8',unit:'',low:'0',high:'5'}),'unknown');
});
test('impossible dates are rejected rather than silently normalised',()=>{
  const m=model();
  assert.throws(()=>m.isoDate('2026-02-30'));
  assert.throws(()=>m.isoDate('2026-13-01'));
  assert.equal(m.isoDate('2026-02-28'),'2026-02-28');
});

test('partial dates and censored values retain their original meaning',()=>{
  const m=model(),base={name:'Synthetic CRP',unit:'мг/л',value:'< 0,1'};
  const year=m.checkLab({...base,date:'2026',datePrecision:'year'});
  assert.equal(year.date,'2026');assert.equal(year.value,'< 0,1');assert.equal(year.valueKind,'censored');
  assert.equal(m.chartRows([year]).length,0);assert.equal(m.status(year),'unknown');
  const unknown=m.checkLab({...base,value:'отрицательно',date:'',datePrecision:'unknown'});
  assert.equal(unknown.date,'');assert.equal(unknown.valueKind,'qualitative');
  assert.throws(()=>m.checkLab({...base,date:'2026-13',datePrecision:'month'}));
  assert.throws(()=>m.checkLab({...base,date:'2026',datePrecision:'day'}));
});

test('classification preserves the source name and only merges compatible groups',()=>{
 const m=model(),base={name:'Synthetic lab A',value:'3',unit:'mg',date:'2026-11-01',canonicalName:'Synthetic catalog'};
 const a=m.checkLab(base),b=m.checkLab({...base,name:'Synthetic lab B'}),c=m.checkLab({...base,unit:'g'});
 assert.equal(a.name,'Synthetic lab A');assert.equal(m.groups([a,b,c]).length,2);
 assert.equal(m.groups([a,b])[0].name,'Synthetic catalog');
});

test('shared references and favorites preserve source references and survive serialization',()=>{
 const m=model(),record=m.checkLab({name:'Synthetic marker',value:'3',unit:'mg',date:'2026-11-01',low:'1',high:'5'}),key=m.groupKey(record);
 const pref=m.checkPreferences({unit:'mg',low:'0',high:'2',useReference:'yes',note:'Synthetic reference'},{favorite:true});
 const prefs=JSON.parse(JSON.stringify({[key]:pref})),g=m.groups([record],prefs)[0];
 assert.equal(g.status,'abnormal');assert.equal(g.preferences.favorite,true);
 assert.equal(record.high,'5');assert.equal(m.status(record),'normal');
 assert.equal(m.referenceRow({...record,unit:'g'},pref).high,'5');
 assert.throws(()=>m.checkPreferences({low:'5',high:'1'}));
 assert.throws(()=>m.checkPreferences({high:'NaN'}));
});
test('CSV supports quoted columns and partial success with row errors',()=>{
  const m=model();
  const csv='Дата;Показатель;Результат;Единица;Мин;Макс\n'+
    '2026-11-01;"Глюкоза; натощак";5,1;ммоль/л;3,9;5,5\n'+
    '2026-02-30;ЛПНП;4;ммоль/л;0;3\n';
  const outcome=m.parseCSV(csv);
  assert.equal(outcome.records.length,1);
  assert.equal(outcome.errors.length,1);
  assert.equal(outcome.records[0].name,'Глюкоза; натощак');
});
test('private GitHub storage uses isolated health-data path and in-memory token',()=>{
  const github=script('health/github.js');
  assert.match(github,/health-data\/v1\/vault\.json/);
  assert.match(github,/info\.private!==true/);
  assert.doesNotMatch(github,/localStorage|sessionStorage/);
  assert.match(github,/expectedSha/);
  const html=script('health/index.html');
  assert.ok(html.indexOf('model.js')<html.indexOf('view.js'));
  assert.ok(html.indexOf('view.js')<html.indexOf('app.js'));
  const builder=script('src/build.py');
  assert.match(builder,/health-route\.js/);
  assert.match(builder,/'health'/);
});

test('lab results are never silently truncated during import',()=>{
 const m=model();assert.throws(()=>m.checkLab({name:'Synthetic marker',value:'x'.repeat(8001),date:'2026-11-01'}));
});

test('exact timestamps keep their timezone and drafts stay out of numerical charts',()=>{
 const m=model(),base={name:'Synthetic time marker',value:'3',unit:'mg',date:'2026-11-01T15:00:00.123456789+03:00',datePrecision:'exact'};
 const row=m.checkLab(base);assert.equal(row.date,base.date);assert.equal(row.datePrecision,'exact');assert.equal(m.chartRows([row]).length,1);
 assert.equal(m.chartRows([{...row,reviewStatus:'draft'}]).length,0);
 assert.throws(()=>m.checkLab({...base,date:'2026-11-01T15:00:00'}));
 assert.throws(()=>m.checkLab({...base,date:'2026-02-30T15:00:00Z'}));
});

test('latest exact measurement is ordered by instant across timezone offsets',()=>{
 const m=model(),base={name:'Synthetic time marker',value:'3',unit:'mg',datePrecision:'exact'};
 const a=m.checkLab({...base,date:'2026-11-01T15:00:00+03:00'}),b=m.checkLab({...base,date:'2026-11-01T14:00:00Z'});
 assert.equal(m.groups([a,b])[0].latest.id,b.id);assert.equal(m.recent([a,b])[0].id,b.id);
});
