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
  assert.equal(m.status({value:'0',low:'1',high:'2'}),'abnormal');
  assert.equal(m.status({value:'2',low:'',high:'3'}),'normal');
  assert.equal(m.status({value:'положительно',low:'',high:'3'}),'unknown');
  assert.equal(m.status({value:'3',low:'',high:''}),'unknown');
});
test('impossible dates are rejected rather than silently normalised',()=>{
  const m=model();
  assert.throws(()=>m.isoDate('2026-02-30'));
  assert.throws(()=>m.isoDate('2026-13-01'));
  assert.equal(m.isoDate('2026-02-28'),'2026-02-28');
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