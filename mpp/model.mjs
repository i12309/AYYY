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
    work:r.work, cost:r.cost
  }));
  const resourceMap = new Map(resources.map(r => [r.uid, r]));
  const assignments = (Array.isArray(project.assignments) ? project.assignments : []).filter(x => x && x.task !== null && x.resource !== null).map(x => ({
    task:String(x.task), resource:String(x.resource), units:x.units, work:x.work, cost:x.cost
  }));
  const tasks = sorted.map(t => ({
    uid:String(t.uniqueId), id:Number(t.id)||0, name:String(t.name||'Без названия'),
    wbs:String(t.wbs||t.outlineNumber||''), level:Math.max(1,Math.min(50,Number(t.outlineLevel)||1)),
    parent:t.parent === null || t.parent === undefined ? null : String(t.parent),
    start:dateValue(t.start), finish:dateValue(t.finish),
    baselineStart:dateValue(t.baselineStart), baselineFinish:dateValue(t.baselineFinish),
    duration:durationText(t.duration), percent:Math.max(0,Math.min(100,Number(t.percentComplete)||0)),
    summary:!!t.summary, milestone:!!t.milestone, critical:!!t.critical,
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
    if (!task.resourceNames) task.resourceNames = assignments.filter(a => a.task === task.uid).map(a => resourceMap.get(a.resource)?.name || '').filter(Boolean).join(', ');
    if (task.children) task.summary = true;
  }
  const validStarts = tasks.map(t=>t.start).filter(t=>t!==null);
  const validFinishes = tasks.map(t=>t.finish).filter(t=>t!==null);
  const projectStart = dateValue(project.start);
  const projectFinish = dateValue(project.finish);
  return {
    title:String(project.title||project.summary?.name||fileName||'Проект'),
    fileName, format:String(project.format||''), author:String(project.author||''),
    start:projectStart ?? (validStarts.length ? Math.min(...validStarts) : null),
    finish:projectFinish ?? (validFinishes.length ? Math.max(...validFinishes) : null),
    tasks, resources, assignments, links, byUid,
    warnings:Array.isArray(project.warnings) ? project.warnings.map(String) : []
  };
}

export function visibleTasks(model, query = '', collapsed = new Set()) {
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
  return model.tasks.filter(t => {
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
  const dates = (model?.tasks || []).flatMap(t => [t.start,t.finish]).filter(v=>v!==null && Number.isFinite(v));
  const today = Math.floor(Date.now() / DAY) * DAY;
  const min = dates.length ? Math.min(...dates) : today;
  const max = dates.length ? Math.max(...dates) : today + 28*DAY;
  const start = Math.floor(min / DAY) * DAY - 7 * DAY;
  const end = Math.floor(max / DAY) * DAY + 14 * DAY;
  return {start, days:Math.max(28,Math.min(10000,Math.ceil((end-start)/DAY)))};
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
    start:d(s),finish:d(e),duration:{value:e-s,units:'d'},percentComplete:percent,
    summary,milestone:s===e,predecessors:id===8?[{task:7,type:'FS'}]:id===9?[{task:8,type:'FS'}]:[]
  }));
  return normalizeProject({format:'Демонстрационный план',title:'Пример проекта · AYYY',tasks,resources:[
    {uniqueId:1,id:1,name:'Аналитик',type:'Work'},
    {uniqueId:2,id:2,name:'Разработчик',type:'Work'}
  ],assignments:[{task:'2',resource:'1'},{task:'6',resource:'2'},{task:'7',resource:'2'}]},'Пример (не MPP)');
}
