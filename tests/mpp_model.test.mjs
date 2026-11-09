import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dateValue, dateText, durationText, normalizeProject, visibleTasks, timelineRange, csvCell, tasksCsv, demoProject, DAY} from '../mpp/model.mjs';
import {readProject} from '../mpp/vendor/mpxj-ts/mpxj.mjs';

test('synthetic demo has stable tasks, groups, assignments, and links', () => {
  const model=demoProject();
  assert.equal(model.tasks.length,9);
  assert.equal(model.resources.length,2);
  assert.equal(model.links.length,2);
  assert.equal(model.byUid.get('6').parent,'4');
  assert.equal(model.byUid.get('4').children,3);
  assert.equal(model.byUid.get('6').resourceNames,'Разработчик');
  assert.equal(model.byUid.get('8').predecessorText,'7');
  assert.equal(model.byUid.get('9').milestone,true);
});

test('collapse summary excludes descendants; search includes ancestors', () => {
  const model=demoProject();
  const collapsed=visibleTasks(model,'',new Set(['4']));
  assert.equal(collapsed.some(t=>t.uid==='4'),true);
  assert.equal(collapsed.some(t=>t.uid==='5'),false);
  assert.equal(collapsed.some(t=>t.uid==='8'),true);
  const matches=visibleTasks(model,'Интеграции',new Set(['4']));
  assert.deepEqual(matches.map(t=>t.uid),['4','7']);
});

test('normalize skips Project summary, rebuilds outline, formats dependencies', () => {
  const project={
    title:'План',tasks:[
      {uniqueId:0,id:0,name:'Summary'},
      {uniqueId:10,id:1,name:'Релиз',outlineLevel:1,summary:true},
      {uniqueId:11,id:2,name:'Подзадача',outlineLevel:2,start:Date.UTC(2026,10,10),finish:Date.UTC(2026,10,12),percentComplete:150,predecessors:[{task:10,type:'FS'}]}
    ],resources:[],assignments:[]
  };
  const model=normalizeProject(project,'sample.mpp');
  assert.equal(model.tasks.length,2);
  assert.equal(model.byUid.get('11').parent,'10');
  assert.equal(model.byUid.get('11').percent,100);
  assert.equal(model.byUid.get('11').predecessorText,'1');
  assert.equal(model.byUid.get('10').children,1);
});

test('UTC wall-clock dates remain timezone-independent', () => {
  assert.equal(dateValue('2026-11-10T09:30:00'),Date.UTC(2026,10,10,9,30));
  assert.equal(dateText(Date.UTC(2026,10,10)),'10.11.2026');
  assert.equal(dateValue(''),null);
  assert.equal(dateValue('nonsense'),null);
  assert.equal(durationText({value:1.5,units:'d'}),'1,5 д');
});

test('timeline includes task dates and caps runaway charts', () => {
  const model=demoProject();
  const range=timelineRange(model);
  assert.ok(range.start <= model.tasks[0].start);
  assert.ok(range.days >= 28);
  const extreme=timelineRange({tasks:[{start:Date.UTC(2000,0,1),finish:Date.UTC(2040,0,1)}]});
  assert.ok(extreme.days <= 10000);
  assert.equal(DAY,86400000);
});

test('CSV escapes formulas, quotes, separators and retains BOM', () => {
  assert.equal(csvCell('=SUM(A1:A2)'),'"\'=SUM(A1:A2)"');
  assert.equal(csvCell('item; "test"'),'"item; ""test"""');
  const model=demoProject();
  model.tasks[0].name='=MALICIOUS()';
  const csv=tasksCsv(model);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"\'=MALICIOUS()"'));
  assert.equal(csv.split('\r\n').length,model.tasks.length+1);
});

test('the actual embedded browser reader imports MSPDI XML with tasks and dependencies', () => {
  const path=fileURLToPath(new URL('./fixtures/ayyy-project-sample.xml',import.meta.url));
  const fixture=readFileSync(path);
  const project=readProject(new Uint8Array(fixture));
  const model=normalizeProject(project,'ayyy-project-sample.xml');
  assert.equal(model.title,'Тестовый проект AYYY');
  assert.equal(model.tasks.length,3);
  assert.equal(model.resources.length,1);
  assert.equal(model.links.length,1);
  assert.equal(model.byUid.get('3').predecessorText,'2');
  assert.equal(model.byUid.get('2').resourceNames,'Аналитик');
  assert.equal(model.byUid.get('3').start,Date.UTC(2026,10,16,9,0));
});

test('parser rejects arbitrary bytes instead of displaying corrupt data', () => {
  assert.throws(()=>readProject(new Uint8Array([1,2,3,4,5,6])));
});
