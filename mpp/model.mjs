/* AYYY Project Viewer — dependency-free, testable view model.
 * The LGPL MPP reader is loaded separately and is not bundled here.
 */
export const DAY = 86400000;

export function dateValue(input) {
  if (input === null || input === undefined || input === '') return null;
  if (input instanceof Date) return Number.isFinite(input.getTime()) ? input.getTime() : null;
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return null;
    const candidate = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?$/.test(trimmed) ? trimmed + (trimmed.includes('T') ? 'Z' : 'T00:00:00Z') : trimmed;
    const parsed = Date.parse(candidate);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function dateText(value) {
  const time = dateValue(value);
  if (time === null) return '—';
  return new Intl.DateTimeFormat('ru-RU', {day:'2-digit', month:'2-digit', year:'numeric', timeZone:'UTC'}).format(time);
}

export function durationText(raw) {
  if (raw === null || raw === undefined) return '—';
  if (typeof raw === 'string') return raw || '—';
  if (typeof raw === 'number') return Number.isFinite(raw) ? String(raw) : '—';
  const value = Number(raw.value);
  if (!Number.isFinite(value)) return '—';
  const unit = ({m:'мин',h:'ч',d:'д',w:'нед',mo:'мес',em:'мин',eh:'ч',ed:'д',ew:'нед',emo:'мес'})[raw.units] || raw.units || '';
  const rounded = Math.round(value * 100) / 100;
  return String(rounded).replace('.', ',') + (unit ? ' ' + unit : '');
}

export function normalizeProject(project, fileName = '') {
  if (!project || !Array.isArray(project.tasks)) throw new Error('В файле не найдена таблица задач.');
  const rawTasks = project.tasks.filter(t => t && !t.blank && Number(t.id) !== 0 && t.uniqueId !== null && t.uniqueId !== undefined);
  const sorted = rawTasks.slice().sort((a,b) => (Number(a.id)||0) - (Number(b.id)||0));
  const resources = (Array.isArray(project.resources) ? project.resources : []).filter(r => r && r.uniqueId !== null && r.uniqueId !== undefined && r.name).map(r => ({
    uid:String(r.uniqueId), id:r.id, name:String(r.name), type:r.type || 'Work',
    initials:r.initials || '', group:r.group || '', maxUnits:r.maxUnits,
    work:r.work, cost:r.cost, calendar:r.calendar==null?null:String(r.calendar),
    standardRate:r.standardRate??null, rateUnits:r.rateUnits||'h'
  }));
  const resourceMap = new Map(resources.map(r => [r.uid, r]));
  const assignments = (Array.isArray(project.assignments) ? project.assignments : []).filter(x => x && x.task !== null && x.resource !== null).map(x => ({
    task:String(x.task), resource:String(x.resource), units:x.units, work:x.work, cost:x.cost
  }));
  const assignedResources = new Map();
  for (const assignment of assignments) {
    if (!assignedResources.has(assignment.task)) assignedResources.set(assignment.task, []);
    const name = resourceMap.get(assignment.resource)?.name;
    if (name) assignedResources.get(assignment.task).push(name);
  }
  const tasks = sorted.map(t => ({
    uid:String(t.uniqueId), id:Number(t.id)||0, name:String(t.name||'Без названия'),
    wbs:String(t.wbs||t.outlineNumber||''), level:Math.max(1,Math.min(50,Number(t.outlineLevel)||1)),
    parent:t.parent === null || t.parent === undefined ? null : String(t.parent),
    start:dateValue(t.start), finish:dateValue(t.finish),
    baselineStart:dateValue(t.baselineStart), baselineFinish:dateValue(t.baselineFinish),
    duration:durationText(t.duration), percent:Math.max(0,Math.min(100,Number(t.percentComplete)||0)),
    summary:!!t.summary, milestone:!!t.milestone, critical:!!t.critical,
    criticalSource:!!t.critical?'Исходный файл':'Не подтверждено',
    totalSlack:t.extra?.TOTAL_SLACK??t.extra?.TOTAL_FLOAT??null,
    freeSlack:t.extra?.FREE_SLACK??t.extra?.FREE_FLOAT??null,
    active:t.active!==false,manual:!!t.manual,estimated:!!t.estimated,
    constraint:String(t.constraint||''),constraintDate:dateValue(t.constraintDate),
    work:t.work??null,cost:t.cost??null,deadline:dateValue(t.extra?.DEADLINE),
    calendar:t.calendar==null?null:String(t.calendar),
    notes:String(t.notes||''), resourceNames:String(t.resourceNames||''),
    predecessors:[], successors:[], predecessorText:'', children:0
  }));
  const byUid = new Map(tasks.map(t => [t.uid,t]));
  // Some MPP variants omit parent UID; infer from outline levels in task order.
  const stack = [];
  for (const task of tasks) {
    while (stack.length && stack[stack.length-1].level >= task.level) stack.pop();
    if (!task.parent || !byUid.has(task.parent) || task.parent === task.uid) task.parent = stack.length ? stack[stack.length-1].uid : null;
    if (task.parent && byUid.has(task.parent)) byUid.get(task.parent).children++;
    stack.push(task);
  }
  const links = [];
  for (const raw of sorted) {
    const to = byUid.get(String(raw.uniqueId));
    for (const dep of (Array.isArray(raw.predecessors) ? raw.predecessors : [])) {
      if (!dep || dep.task === undefined || dep.task === null) continue;
      const from = byUid.get(String(dep.task));
      if (!from || !to) continue;
      const type = String(dep.type || 'FS').toUpperCase();
      const link = {from:from.uid,to:to.uid,type:['FS','FF','SF','SS'].includes(type)?type:'FS',lag:durationText(dep.lag) === '—' ? '' : durationText(dep.lag)};
      links.push(link); to.predecessors.push(link); from.successors.push(link);
    }
  }
  for (const task of tasks) {
    task.predecessorText = task.predecessors.map(l => {
      const from = byUid.get(l.from);
      return String(from.id) + (l.type === 'FS' ? '' : l.type) + (l.lag ? ' + ' + l.lag : '');
    }).join(', ');
    if (!task.resourceNames) task.resourceNames = (assignedResources.get(task.uid) || []).join(', ');
    if (task.children) task.summary = true;
  }
  const calendars=(Array.isArray(project.calendars)?project.calendars:[]).filter(c=>c&&c.uniqueId!=null).map(c=>({
    uid:String(c.uniqueId),name:String(c.name||'Календарь'),parent:c.parent==null?null:String(c.parent),
    resource:c.resource==null?null:String(c.resource),
    days:Array.isArray(c.days)?c.days.map(d=>({type:['working','nonworking','default'].includes(d?.type)?d.type:'default',hours:cleanHours(d?.hours)})):[],
    weeks:Array.isArray(c.weeks)?c.weeks.map(w=>({name:String(w.name||''),from:dateValue(w.from),to:dateValue(w.to),
      days:Array.isArray(w.days)?w.days.map(d=>({type:['working','nonworking','default'].includes(d?.type)?d.type:'default',hours:cleanHours(d?.hours)})):[]})):[],
    exceptions:Array.isArray(c.exceptions)?c.exceptions.map(e=>({name:String(e.name||''),from:dateValue(e.from),to:dateValue(e.to),hours:cleanHours(e.hours),
      recurrence:String(e.recurrence||''),dates:Array.isArray(e.dates)?e.dates.filter(Number.isFinite):null})):[]
  }));
  const validStarts = tasks.map(t=>t.start).filter(t=>t!==null);
  const validFinishes = tasks.map(t=>t.finish).filter(t=>t!==null);
  const projectStart = dateValue(project.start);
  const projectFinish = dateValue(project.finish);
  return {
    title:String(project.title||project.summary?.name||fileName||'Проект'),
    fileName, format:String(project.format||''), author:String(project.author||''),
    start:projectStart ?? (validStarts.length ? validStarts.reduce((min,value)=>Math.min(min,value),Infinity) : null),
    finish:projectFinish ?? (validFinishes.length ? validFinishes.reduce((max,value)=>Math.max(max,value),-Infinity) : null),
    tasks, resources, assignments, links, byUid, calendars,
    calendar:project.calendar==null?null:String(project.calendar),
    minutesPerDay:Number(project.minutesPerDay)||480,
    minutesPerWeek:Number(project.minutesPerWeek)||2400,
    statusDate:dateValue(project.statusDate),
    warnings:Array.isArray(project.warnings) ? project.warnings.map(String) : []
  };
}

function cleanHours(hours) {
  return (Array.isArray(hours)?hours:[]).filter(h=>Number.isFinite(h?.start)&&Number.isFinite(h?.end) && h.start>=0 && h.end>h.start && h.end<=1440)
    .map(h=>({start:h.start,end:h.end}));
}

/** Return read-only working hours, inheriting base calendar and overrides. Null means unknown. */
export function workingHoursOnDate(model, date, calendarId = model?.calendar) {
  const value=dateValue(date);
  if(value===null || !Number.isFinite(value) || calendarId==null)return null;
  const day=Math.floor(value/DAY)*DAY;
  const byId=new Map((model?.calendars||[]).map(c=>[c.uid,c]));
  const weekday=new Date(day).getUTCDay();
  let uid=String(calendarId),loops=0;
  const visited=new Set();
  while(uid && loops++<30 && !visited.has(uid)) {
    visited.add(uid);
    const cal=byId.get(uid);
    if(!cal)return null;
    for(const ex of cal.exceptions||[]) {
      const matches=Array.isArray(ex.dates)?ex.dates.includes(day):ex.from!==null && ex.to!==null && day>=ex.from && day<=ex.to;
      if(matches)return ex.hours;
    }
    const activeWeek=(cal.weeks||[]).find(w=>w.from!==null && w.to!==null && day>=w.from && day<=w.to);
    const entry=(activeWeek?.days?.[weekday]||cal.days?.[weekday])||null;
    if(entry?.type==='working')return entry.hours;
    if(entry?.type==='nonworking')return [];
    uid=cal.parent;
  }
  return null;
}

export function calendarStats(model, calendarId = model?.calendar) {
  const calendar=(model?.calendars||[]).find(c=>c.uid===String(calendarId));
  if(!calendar)return null;
  const reference=Date.UTC(2026,0,4);
  const week=Array.from({length:7},(_,i)=>workingHoursOnDate(model,reference+i*DAY,calendar.uid));
  return {calendar,week,exceptions:calendar.exceptions.length,workWeeks:calendar.weeks.length};
}

/** Per-project warning: imported "critical" flags do not mean we recalculated CPM. */
export function criticalReport(model) {
  const flagged=(model?.tasks||[]).filter(t=>t.critical).length;
  return {flagged,total:model?.tasks?.length||0,sourceOnly:true};
}

/**
 * A READ-ONLY longest-chain indicator, NOT Microsoft Project CPM.
 * When the file supplies critical flags those always take precedence.
 * Otherwise estimate only for an acyclic FS network with no lag; do not
 * silently produce a misleading path for FF/SS/SF, lead/lag or invalid dates.
 */
export function criticalChain(model) {
  const source=new Set((model?.tasks||[]).filter(t=>t.critical).map(t=>t.uid));
  if(source.size)return {mode:'source',uids:source,reason:'Признаки критичности предоставлены исходным файлом'};
  const tasks=(model?.tasks||[]).filter(t=>!t.summary && t.active!==false && t.start!==null && t.finish!==null && t.finish>=t.start);
  if(!tasks.length)return {mode:'none',uids:new Set(),reason:'Нет задач с корректными датами'};
  if(tasks.some(t=>t.manual))return {mode:'none',uids:new Set(),reason:'Есть задачи с ручным планированием'};
  const byUid=new Map(tasks.map(t=>[t.uid,t])),edges=new Map(),degree=new Map();
  for(const task of tasks){edges.set(task.uid,[]);degree.set(task.uid,0);}
  for(const link of model.links||[]) {
    if(!byUid.has(link.from)||!byUid.has(link.to))continue;
    if(link.type!=='FS'||(link.lag && link.lag!=='0 д' && link.lag!=='0 ч' && link.lag!=='0 мин'))
      return {mode:'none',uids:new Set(),reason:'В зависимостях есть типы кроме FS либо опережения/задержки'};
    edges.get(link.from).push(link.to);
    degree.set(link.to,degree.get(link.to)+1);
  }
  const queue=tasks.filter(t=>degree.get(t.uid)===0).map(t=>t.uid);
  const length=new Map(tasks.map(t=>[t.uid,Math.max(0,(t.finish-t.start)/DAY)]));
  const parents=new Map(tasks.map(t=>[t.uid,[]]));
  const eps=1e-7;
  let visited=0;
  for(let index=0;index<queue.length;index++) {
    const uid=queue[index];visited++;
    for(const child of edges.get(uid)) {
      const weight=Math.max(0,(byUid.get(child).finish-byUid.get(child).start)/DAY);
      const candidate=length.get(uid)+weight;
      if(candidate>length.get(child)+eps) {
        length.set(child,candidate);parents.set(child,[uid]);
      } else if(Math.abs(candidate-length.get(child))<=eps)parents.get(child).push(uid);
      degree.set(child,degree.get(child)-1);
      if(degree.get(child)===0)queue.push(child);
    }
  }
  if(visited!==tasks.length)return {mode:'none',uids:new Set(),reason:'Циклические зависимости: оценка недоступна'};
  const longest=Math.max(...length.values());
  if(!Number.isFinite(longest) || longest<=0)return {mode:'none',uids:new Set(),reason:'Недостаточно сведений о длительностях'};
  const ids=new Set();
  const stack=tasks.filter(t=>Math.abs(length.get(t.uid)-longest)<=eps).map(t=>t.uid);
  while(stack.length) {
    const uid=stack.pop();
    if(ids.has(uid))continue;
    ids.add(uid);
    stack.push(...parents.get(uid));
  }
  return {mode:'estimate',uids:ids,reason:'Приблизительная самая длинная цепочка по фактическим датам, без пересчёта расписания, календарей и ограничений'};
}

/** Stable hierarchy-aware sibling sorting preserves the parent-before-child invariant. */
export function orderedTasks(model, sort='id') {
  const list=model?.tasks||[];
  if(sort==='id'||!['name','start','finish','percent','duration'].includes(sort))return list;
  const byParent=new Map(),known=new Set(list.map(t=>t.uid));
  for (const task of list) {
    const parent=task.parent && known.has(task.parent)?task.parent:null;
    if(!byParent.has(parent))byParent.set(parent,[]);
    byParent.get(parent).push(task);
  }
  const cmp=(a,b)=>{
    let value=0;
    if(sort==='name')value=a.name.localeCompare(b.name,'ru',{numeric:true,sensitivity:'base'});
    else if(sort==='duration')value=(Number.parseFloat(String(a.duration).replace(',','.'))||0)-(Number.parseFloat(String(b.duration).replace(',','.'))||0);
    else value=sort==='percent'?a.percent-b.percent:(a[sort]??Infinity)-(b[sort]??Infinity);
    return value || a.id-b.id;
  };
  for(const group of byParent.values())group.sort(cmp);
  const result=[],done=new Set(),stack=[...(byParent.get(null)||[])].reverse();
  while(stack.length) {
    const task=stack.pop();
    if(done.has(task.uid))continue;
    done.add(task.uid);result.push(task);
    for(const child of (byParent.get(task.uid)||[]).slice().reverse())stack.push(child);
  }
  // Corrupt parent cycles must never make tasks disappear.
  for(const task of list)if(!done.has(task.uid))result.push(task);
  return result;
}

export function visibleTasks(model, query = '', collapsed = new Set(), sort = 'id') {
  if (!model) return [];
  const q = query.trim().toLocaleLowerCase();
  const included = q ? new Set() : null;
  if (q) for (const t of model.tasks) {
    if (![t.name,t.wbs,String(t.id),t.resourceNames,t.predecessorText].some(v => v.toLocaleLowerCase().includes(q))) continue;
    included.add(t.uid);
    let parent = t.parent, guard = 0;
    while (parent && model.byUid.has(parent) && guard++ < 60) {
      if (included.has(parent)) break;
      included.add(parent);
      parent = model.byUid.get(parent).parent;
    }
  }
  return orderedTasks(model,sort).filter(t => {
    if (included && !included.has(t.uid)) return false;
    if (q) return true;
    let parent = t.parent, guard = 0;
    while (parent && model.byUid.has(parent) && guard++ < 60) {
      if (collapsed.has(parent)) return false;
      parent = model.byUid.get(parent).parent;
    }
    return true;
  });
}

export function timelineRange(model) {
  const dates = (model?.tasks || []).flatMap(t => [t.start,t.finish,t.baselineStart,t.baselineFinish]).filter(v=>v!==null && Number.isFinite(v));
  const today = Math.floor(Date.now() / DAY) * DAY;
  const min = dates.length ? dates.reduce((result,value)=>Math.min(result,value),Infinity) : today;
  const max = dates.length ? dates.reduce((result,value)=>Math.max(result,value),-Infinity) : today + 28*DAY;
  // Keep a small visual margin without wasting full weeks at either end.
  const start = Math.floor(min / DAY) * DAY - 3 * DAY;
  const end = Math.floor(max / DAY) * DAY + 5 * DAY;
  return {start, days:Math.max(28,Math.min(10000,Math.ceil((end-start)/DAY)))};
}

/** Keep the DOM bounded even when a project contains thousands of tasks. */
export function rowWindow(total, scrollTop = 0, viewportHeight = 500, size = 34, overscan = 14) {
  const count = Math.max(0, Math.trunc(total) || 0);
  if (count <= 160) return {start:0,end:count,top:0,bottom:0};
  const first = Math.max(0, Math.floor(Math.max(0, scrollTop) / size));
  const visible = Math.max(1, Math.ceil(Math.max(size, viewportHeight) / size));
  const start = Math.max(0, Math.min(count, first) - overscan);
  const end = Math.min(count, first + visible + overscan);
  return {start,end,top:start*size,bottom:(count-end)*size};
}

/** SVG routes for visible dependency links (FS, SS, FF and SF). */
export function dependencyLines(tasks, links, timelineStart, pixelsPerDay, size = 34) {
  const rows = new Map(tasks.map((task, index) => [task.uid, {task,index}]));
  const routes = [];
  for (const link of links) {
    const source = rows.get(link.from), target = rows.get(link.to);
    if (!source || !target) continue;
    const fromFinish = link.type === 'FS' || link.type === 'FF';
    const toFinish = link.type === 'FF' || link.type === 'SF';
    const fromDate = source.task[fromFinish ? 'finish' : 'start'];
    const toDate = target.task[toFinish ? 'finish' : 'start'];
    if (fromDate === null || toDate === null || !Number.isFinite(fromDate) || !Number.isFinite(toDate)) continue;
    const x1 = Math.round((fromDate-timelineStart)/DAY*pixelsPerDay + (fromFinish ? pixelsPerDay : 0));
    const x2 = Math.round((toDate-timelineStart)/DAY*pixelsPerDay + (toFinish ? pixelsPerDay : 0));
    const y1 = Math.round((source.index+.5)*size), y2 = Math.round((target.index+.5)*size);
    const elbow = x2 >= x1+24 ? Math.round((x1+x2)/2) : Math.max(x1,x2)+16;
    routes.push({d:`M${x1} ${y1} H${elbow} V${y2} H${x2}`,from:link.from,to:link.to,
      critical:source.task.critical && target.task.critical});
  }
  return routes;
}

export function csvCell(value) {
  const original = String(value === null || value === undefined ? '' : value);
  const safe = /^[\s]*[=+\-@\t\r]/.test(original) ? "'" + original : original;
  return '"' + safe.replaceAll('"','""') + '"';
}

export function tasksCsv(model) {
  const lines = [['ID','WBS','Название','Начало','Окончание','Длительность','Готовность, %','Ресурсы','Предшественники']];
  for (const t of model.tasks) lines.push([t.id,t.wbs,t.name,dateText(t.start),dateText(t.finish),t.duration,t.percent,t.resourceNames,t.predecessorText]);
  return '\uFEFF' + lines.map(row=>row.map(csvCell).join(';')).join('\r\n');
}

export function demoProject() {
  const day = Math.floor(Date.now()/DAY)*DAY;
  const d = n => day+n*DAY;
  const names = [
    [1,'Подготовка проекта',1,0,12,100,true],
    [2,'Сбор требований',2,0,5,100,false],
    [3,'Проверка концепции',2,5,12,100,false],
    [4,'Разработка',1,12,44,45,true],
    [5,'Архитектура и прототип',2,12,20,100,false],
    [6,'Реализация интерфейса',2,20,36,50,false],
    [7,'Интеграции',2,29,44,15,false],
    [8,'Тестирование',1,42,55,0,false],
    [9,'Публикация',1,57,57,0,false]
  ];
  const tasks=names.map(([id,name,level,s,e,percent,summary])=>({
    id,uniqueId:id,name,outlineLevel:level,outlineNumber:String(id),wbs:String(id),
    start:d(s),finish:d(e),baselineStart:id===6?d(18):id===7?d(27):null,baselineFinish:id===6?d(33):id===7?d(40):null,
    duration:{value:e-s,units:'d'},percentComplete:percent,
    summary,milestone:s===e,predecessors:id===8?[{task:7,type:'FS'}]:id===9?[{task:8,type:'FS'}]:[]
  }));
  return normalizeProject({format:'Демонстрационный план',title:'Пример проекта · AYYY',tasks,resources:[
    {uniqueId:1,id:1,name:'Аналитик',type:'Work'},
    {uniqueId:2,id:2,name:'Разработчик',type:'Work'}
  ],assignments:[{task:'2',resource:'1'},{task:'6',resource:'2'},{task:'7',resource:'2'}]},'Пример (не MPP)');
}
