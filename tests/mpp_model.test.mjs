import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dateValue, dateText, durationText, normalizeProject, visibleTasks, workingHoursOnDate, calendarStats, orderedTasks, criticalChain, timelineRange, rowWindow, dependencyLines, csvCell, tasksCsv, demoProject, DAY} from '../mpp/model.mjs';
import {readProject} from '../mpp/vendor/mpxj-ts/mpxj.mjs';
import {ganttSvg} from '../mpp/export-svg.mjs';

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
  assert.equal(model.calendar,'1');
  assert.equal(model.calendars.length,1);
  assert.equal(model.calendars[0].name,'Стандартный');
  assert.deepEqual(workingHoursOnDate(model,Date.UTC(2026,10,17)),[],'MSPDI holiday applies');
  assert.equal(workingHoursOnDate(model,Date.UTC(2026,10,16))?.length,2,'weekday working intervals imported');
});

test('parser rejects arbitrary bytes instead of displaying corrupt data', () => {
  assert.throws(()=>readProject(new Uint8Array([1,2,3,4,5,6])));
});

test('baseline dates are included in gantt range', () => {
  const model=demoProject();
  const earlier=Date.UTC(2020,0,1);
  model.tasks[0].baselineStart=earlier;
  assert.ok(timelineRange(model).start<=earlier);
  assert.ok(model.tasks.some(t=>t.baselineStart!==null));
});

test('virtualization bounds rendered rows and supports scrolling to the end', () => {
  assert.deepEqual(rowWindow(0),{start:0,end:0,top:0,bottom:0});
  assert.deepEqual(rowWindow(9),{start:0,end:9,top:0,bottom:0});
  const first=rowWindow(5000,0,600);
  assert.ok(first.end<=40);
  const last=rowWindow(5000,5000*34,600);
  assert.equal(last.end,5000);
  assert.ok(last.start>=4970);
  assert.equal(last.top+(last.end-last.start)*34+last.bottom,5000*34);
});

test('dependency geometry supports all four Microsoft Project link types', () => {
  const begin=Date.UTC(2026,0,1);
  const tasks=[
    {uid:'1',start:begin,finish:begin+2*DAY,critical:true},
    {uid:'2',start:begin+3*DAY,finish:begin+7*DAY,critical:true}
  ];
  const links=['FS','SS','FF','SF'].map(type=>({from:'1',to:'2',type}));
  const paths=dependencyLines(tasks,links,begin-7*DAY,12);
  assert.equal(paths.length,4);
  assert.ok(paths.every(p=>/^M\d+ \d+ H\d+ V\d+ H\d+$/.test(p.d)));
  assert.ok(paths.every(p=>p.critical));
  assert.notEqual(paths[0].d,paths[1].d);
  assert.notEqual(paths[1].d,paths[2].d);
  assert.equal(dependencyLines(tasks,[{from:'missing',to:'2',type:'FS'}],begin,12).length,0);
});


test('calendar inheritance, holidays, work weeks and unknown dates are safe',()=>{
  const mon=Date.UTC(2026,10,9), tue=mon+DAY, holiday=mon+7*DAY;
  const base={uniqueId:1,name:'Base',parent:null,days:Array.from({length:7},(_,i)=>
    ({type:i===0||i===6?'nonworking':'working',hours:i===0||i===6?[]:[{start:540,end:780},{start:840,end:1080}]})),
    weeks:[],exceptions:[{name:'Holiday',from:holiday,to:holiday,hours:[],dates:null,recurrence:''}]};
  const child={uniqueId:2,name:'Team',parent:1,days:Array.from({length:7},()=>({type:'default',hours:[]})),
    weeks:[{name:'Short week',from:mon,to:mon+6*DAY,days:Array.from({length:7},(_,i)=>({type:i===2?'working':'default',hours:i===2?[{start:600,end:720}]:[]}))}],
    exceptions:[{name:'Tuesday special',from:tue,to:tue,hours:[{start:630,end:660}],dates:null,recurrence:''}]};
  const model=normalizeProject({title:'Calendar',tasks:[{id:1,uniqueId:1,name:'Task',start:mon,finish:tue}],calendars:[base,child],calendar:2});
  assert.deepEqual(workingHoursOnDate(model,mon),base.days[1].hours);
  assert.deepEqual(workingHoursOnDate(model,tue),[{start:630,end:660}], 'exception overrides workweek');
  assert.deepEqual(workingHoursOnDate(model,holiday),[], 'inherited holiday must be nonworking');
  assert.equal(workingHoursOnDate(model,null),null, 'null date must not become Unix epoch');
  assert.equal(workingHoursOnDate(model,mon,'999'),null);
  assert.equal(calendarStats(model,2).exceptions,1);
  assert.equal(model.calendars.length,2);
});

test('hierarchy-aware sorting only reorders siblings',()=>{
  const model=normalizeProject({tasks:[
    {uniqueId:1,id:1,name:'B group',outlineLevel:1},
    {uniqueId:2,id:2,name:'Z child',outlineLevel:2},
    {uniqueId:3,id:3,name:'A child',outlineLevel:2},
    {uniqueId:4,id:4,name:'A group',outlineLevel:1},
    {uniqueId:5,id:5,name:'Child',outlineLevel:2}
  ]});
  assert.deepEqual(orderedTasks(model,'name').map(x=>x.uid),['4','5','1','3','2']);
  assert.deepEqual(visibleTasks(model,'',new Set(),'name').map(x=>x.uid),['4','5','1','3','2']);
  assert.deepEqual(visibleTasks(model,'',new Set(['1']),'name').map(x=>x.uid),['4','5','1']);
});

test('critical path flags are never silently substituted by approximation',()=>{
  const d=Date.UTC(2026,0,1), t=(id,s,e,preds=[],extra={})=>({id,uniqueId:id,name:'Task '+id,outlineLevel:1,start:d+s*DAY,finish:d+e*DAY,
    predecessors:preds.map(task=>({task,type:'FS'})),...extra});
  const source=normalizeProject({tasks:[t(1,0,3,[],{critical:true}),t(2,3,5,[1]),t(3,0,8)]});
  assert.equal(criticalChain(source).mode,'source');
  assert.deepEqual([...criticalChain(source).uids],['1']);
  const simple=normalizeProject({tasks:[t(1,0,5),t(2,5,10,[1]),t(3,0,4)]});
  assert.equal(criticalChain(simple).mode,'estimate');
  assert.deepEqual([...criticalChain(simple).uids].sort(),['1','2']);
  simple.links[0].type='FF';
  assert.equal(criticalChain(simple).mode,'none','unsupported link types must not give false CPM');
  simple.links[0].type='FS';simple.links[0].lag='2 д';
  assert.equal(criticalChain(simple).mode,'none','lagged links need full scheduler');
  simple.links[0].lag='';simple.links.push({from:'2',to:'1',type:'FS',lag:''});
  assert.equal(criticalChain(simple).mode,'none','cycles must disable path estimate');
});


test('local SVG export is standalone, read-only and properly escapes project text',()=>{
  const model=demoProject();
  model.title='План <PRIVATE & COMPANY>';
  const diagram=ganttSvg(model,model.tasks,{zoom:'week',criticalIds:new Set(['7'])});
  assert.match(diagram,/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.ok(diagram.includes('План &lt;PRIVATE &amp; COMPANY&gt;'));
  assert.ok(diagram.includes('fill="#c68068"'),'highlighted chain must be visible');
  assert.ok(diagram.includes('Публикация'));
  assert.ok(diagram.endsWith('</svg>'));
  assert.throws(()=>ganttSvg(model,Array.from({length:1001},()=>model.tasks[0])),/1000/);
});
