/* AYYY Project Viewer — local-only Microsoft Project plan reader and Gantt UI. */
import {DAY, dateValue, dateText, normalizeProject, visibleTasks, timelineRange, rowWindow, dependencyLines, workingHoursOnDate, criticalChain, tasksCsv, demoProject} from './model.mjs';

import {ganttSvg} from './export-svg.mjs';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const zoomWidths = {day:18,week:8,month:3.2};
const rowHeight = 34;
let parserPromise = null;
const loadParser = () => parserPromise ||= import('./vendor/mpxj-ts/mpxj.mjs').catch(error => {parserPromise = null; throw error;});
const numberLabel = value => Number.isFinite(Number(value)) ? new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(value) : '—';
const dateAt = ms => new Date(ms);
const monthName = date => new Intl.DateTimeFormat('ru-RU',{month:'long',year:'numeric',timeZone:'UTC'}).format(date);
const shortDay = date => new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',timeZone:'UTC'}).format(date);
const className = (task,criticalIds) => task.milestone?'pv-milestone':task.summary?'pv-summary':criticalIds.has(task.uid)?'pv-critical':'pv-ordinary';
const todayStamp=()=>{const now=new Date();return Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());};

function ganttMarkup(tasks, model, zoom, selectedUid, viewport, showLinks = true, showBaseline = true, options = {}) {
  const range = timelineRange(model), pixel = zoomWidths[zoom] || zoomWidths.week;
  const width = Math.round(range.days * pixel);
  const end = range.start + range.days * DAY;
  const criticalIds=options.criticalIds||new Set();
  const calendarId=options.calendarId||model.calendar;
  const months = [];
  let date = Date.UTC(new Date(range.start).getUTCFullYear(),new Date(range.start).getUTCMonth(),1);
  for (let safety=0;date<end && safety<400;safety++) {
    const next = new Date(date);
    next.setUTCMonth(next.getUTCMonth()+1);
    const finish = next.getTime();
    const left = Math.max(0,(date-range.start)/DAY*pixel);
    const right = Math.min(width,(finish-range.start)/DAY*pixel);
    if (right>left) months.push('<span class="pv-month" style="left:'+Math.round(left)+'px;width:'+Math.round(right-left)+'px">'+escapeHtml(monthName(new Date(date)))+'</span>');
    date=finish;
  }
  // Space ticks by readable date labels, not by a wasteful fixed day width.
  const steps = zoom==='day'?2:zoom==='week'?7:30;
  const ticks=[];
  for(let n=0;n<Math.min(600,Math.ceil(range.days/steps));n++){
    const left=Math.round(n*steps*pixel);
    ticks.push('<span class="pv-tick" style="left:'+left+'px">'+escapeHtml(shortDay(new Date(range.start+n*steps*DAY)))+'</span>');
  }
  const items=tasks.slice(viewport.start,viewport.end);
  const leftRows=[],rightRows=[];
  for(const task of items){
    const id=escapeHtml(task.uid), selected=task.uid===selectedUid?' is-selected':'';
    const depth=Math.min(7,Math.max(0,task.level-1));
    leftRows.push(
      '<div class="pv-list-row'+selected+'" data-pv-task="'+id+'" role="row" aria-selected="'+String(!!selected)+'">'+
      '<span class="pv-task-name" style="--pv-depth:'+depth+'">'+
      (task.children>0?'<button type="button" class="pv-fold" data-pv-fold="'+id+'" aria-label="Свернуть или развернуть группу"><span data-fold-icon="'+id+'">▾</span></button>':'<span class="pv-fold-spacer"></span>')+
      '<span class="pv-wbs">'+escapeHtml(task.wbs || String(task.id))+'</span>'+
      '<span class="pv-task-label" title="'+escapeHtml(task.name)+'">'+escapeHtml(task.name)+'</span></span>'+
      '<span class="pv-cell pv-start">'+dateText(task.start)+'</span>'+
      '<span class="pv-cell pv-finish">'+dateText(task.finish)+'</span>'+
      '<span class="pv-cell pv-duration">'+escapeHtml(task.duration)+'</span>'+
      '<span class="pv-cell pv-percent">'+numberLabel(task.percent)+'%</span></div>'
    );
    let bar='', baseline='';
    if(task.start!==null && task.finish!==null){
      const left=Math.round((task.start-range.start)/DAY*pixel), right=Math.round((task.finish-range.start)/DAY*pixel);
      if(right>=0 && left<=width){
        const tooltip=escapeHtml(task.name)+' · '+dateText(task.start)+' — '+dateText(task.finish)+' · '+numberLabel(task.percent)+'%';
        if(task.milestone || task.start===task.finish){
          bar='<span class="pv-task-diamond" style="left:'+Math.max(0,left)+'px" title="'+tooltip+'" aria-label="Веха: '+tooltip+'"></span>';
        }else{
          const size=Math.max(5,right-left+pixel);
          bar='<span class="pv-task-bar '+className(task,criticalIds)+'" style="left:'+Math.max(0,left)+'px;width:'+size+'px" title="'+tooltip+'">'+
            '<span class="pv-bar-progress" style="width:'+task.percent+'%"></span>'+
            (size>105?'<span class="pv-bar-title">'+escapeHtml(task.name)+'</span>':'')+'</span>';
        }
      }
    }
    if(showBaseline && task.baselineStart!==null && task.baselineFinish!==null && task.baselineFinish>=task.baselineStart){
      const left=Math.round((task.baselineStart-range.start)/DAY*pixel);
      const right=Math.round((task.baselineFinish-range.start)/DAY*pixel+pixel);
      if(right>=0 && left<=width){
        baseline='<span class="pv-baseline" style="left:'+Math.max(0,left)+'px;width:'+Math.max(3,Math.min(width,right)-Math.max(0,left))+'px" title="Базовый план: '+dateText(task.baselineStart)+' — '+dateText(task.baselineFinish)+'"></span>';
      }
    }
    rightRows.push('<div class="pv-chart-row'+selected+'" data-pv-task="'+id+'" role="row" aria-selected="'+String(!!selected)+'" style="width:'+width+'px;background-size:'+(7*pixel)+'px 100%">'+bar+baseline+'</div>');
  }
  const before='<div class="pv-row-space" style="height:'+viewport.top+'px"></div>';
  const after='<div class="pv-row-space" style="height:'+viewport.bottom+'px"></div>';
  let connectors='';
  if(showLinks && model.links.length && items.length){
    const routes=dependencyLines(items,model.links,range.start,pixel).filter(x=>!/[Nn]a[Nn]/.test(x.d));
    if(routes.length){
      connectors='<svg class="pv-links" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+(items.length*rowHeight)+'" style="top:'+viewport.top+'px" viewBox="0 0 '+width+' '+(items.length*rowHeight)+'">'+
        '<defs><marker id="pv-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L8 4L0 8" fill="#73949c"/></marker></defs>'+
        routes.map(route=>'<path class="pv-link'+(route.critical?' pv-link-critical':'')+'" d="'+route.d+'" marker-end="url(#pv-arrow)"/>').join('')+'</svg>';
    }
  }
  let overlays='';
  if(options.showCalendar && model.calendars?.length && calendarId && range.days<=900) {
    const offdays=[];
    for(let n=0;n<range.days;n++){
      const hours=workingHoursOnDate(model,range.start+n*DAY,calendarId);
      if(hours && !hours.length)offdays.push('<span class="pv-nonwork" style="left:'+Math.round(n*pixel)+'px;width:'+Math.max(1,Math.ceil(pixel))+'px"></span>');
    }
    if(offdays.length)overlays='<div class="pv-calendar-overlay" aria-hidden="true">'+offdays.join('')+'</div>';
  }
  if(options.showToday){
    const t=todayStamp();
    if(t>=range.start && t<end)overlays+='<span class="pv-today-line" style="left:'+Math.round((t-range.start)/DAY*pixel)+'px" title="Сегодня"></span>';
  }
  return {
    left:'<div class="pv-list-head"><span>Задача / WBS</span><span>Начало</span><span>Окончание</span><span>Длит.</span><span>Готово</span></div><div class="pv-list-rows">'+before+leftRows.join('')+after+'</div>',
    right:'<div class="pv-chart-head" style="width:'+width+'px"><div class="pv-months">'+months.join('')+'</div><div class="pv-ticks">'+ticks.join('')+'</div></div>'+
      '<div class="pv-chart-rows" style="width:'+width+'px">'+before+rightRows.join('')+after+overlays+connectors+'</div>'
  };
}

function resourceMarkup(model, query) {
  const q=query.trim().toLocaleLowerCase();
  const resources=model.resources.filter(r => (r.name+' '+r.group+' '+r.initials).toLocaleLowerCase().includes(q));
  const resourceTasks=new Map();
  for(const a of model.assignments){
    const names=resourceTasks.get(a.resource)||[];
    const name=model.byUid.get(a.task)?.name;
    if(name)names.push(name);
    resourceTasks.set(a.resource,names);
  }
  const rows=resources.map(r=>{
    const names=resourceTasks.get(r.uid)||[];
    return '<tr><td><strong>'+escapeHtml(r.name)+'</strong></td><td>'+escapeHtml(r.type)+'</td><td>'+escapeHtml(r.group||'—')+'</td><td>'+escapeHtml(r.initials||'—')+'</td><td>'+escapeHtml(numberLabel(r.work))+'</td><td>'+escapeHtml(numberLabel(r.cost))+'</td><td title="'+escapeHtml(names.join(', '))+'">'+names.length+'</td></tr>';
  }).join('');
  return '<div class="pv-resource-container"><table class="pv-resource-table"><thead><tr><th>Ресурс</th><th>Тип</th><th>Группа</th><th>Инициалы</th><th>Работа</th><th>Стоимость</th><th>Назначений</th></tr></thead><tbody>'+rows+'</tbody></table>'+(rows?'':'<div class="pv-no-data">По вашему запросу ресурсов не найдено.</div>')+'</div>';
}

function calendarMarkup(model, selectedUid) {
  const calendars=model.calendars||[];
  if(!calendars.length)return '<div class="pv-calendar-empty">В исходном файле нет доступного описания рабочих календарей. Даты задач показаны такими, какими их сохранил Microsoft Project; пересчёта расписания нет.</div>';
  const selected=calendars.find(c=>c.uid===selectedUid)||calendars.find(c=>c.uid===model.calendar)||calendars[0];
  const dayNames=['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
  const base=Date.UTC(2026,0,4); // Sunday; avoid local timezone ambiguity
  const showTime=minutes=>String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');
  const week=dayNames.map((name,index)=>{
    const hours=workingHoursOnDate(model,base+index*DAY,selected.uid);
    const label=hours===null?'Неизвестно':hours.length?hours.map(h=>showTime(h.start)+'–'+showTime(h.end)).join(', '):'Выходной';
    return '<div class="pv-calendar-day"><strong>'+name+'</strong><span>'+escapeHtml(label)+'</span></div>';
  }).join('');
  const exceptions=(selected.exceptions||[]).slice(0,80).map(ex=>'<tr><td>'+escapeHtml(ex.name||'Исключение')+'</td><td>'+
    escapeHtml(ex.from===null?'—':dateText(ex.from))+'</td><td>'+escapeHtml(ex.to===null?'—':dateText(ex.to))+'</td><td>'+
    escapeHtml(ex.hours.length?ex.hours.map(h=>showTime(h.start)+'–'+showTime(h.end)).join(', '):'Нерабочее время')+
    (ex.recurrence?' · Повторение':'')+'</td></tr>').join('');
  const weeks=(selected.weeks||[]).slice(0,40).map(w=>'<tr><td>'+escapeHtml(w.name||'Особая рабочая неделя')+'</td><td>'+
    dateText(w.from)+'</td><td>'+dateText(w.to)+'</td></tr>').join('');
  return '<div class="pv-calendar-view"><div class="pv-calendar-intro"><strong>Рабочие календари из файла</strong><p>Информация приведена для просмотра: сроки задач не пересчитываются. Для специальных недель и исключений ориентируйтесь на таблицы ниже.</p></div>'+
    '<div class="pv-calendar-choices">'+calendars.map(c=>'<button type="button" class="pv-calendar-choice" data-pv-calendar="'+escapeHtml(c.uid)+'" aria-pressed="'+(c.uid===selected.uid)+'">'+escapeHtml(c.name)+(c.uid===model.calendar?' · проект':'')+'</button>').join('')+'</div>'+
    '<div class="pv-calendar-summary"><strong>'+escapeHtml(selected.name)+'</strong><span>'+(selected.parent?'Наследует базовый календарь · ':'')+
    (selected.exceptions||[]).length+' исключений · '+(selected.weeks||[]).length+' особых недель</span></div>'+
    '<div class="pv-calendar-week">'+week+'</div>'+
    '<div class="pv-calendar-section"><h3>Исключения и праздники</h3>'+(exceptions?'<table class="pv-resource-table"><thead><tr><th>Название</th><th>Начало</th><th>Окончание</th><th>Время</th></tr></thead><tbody>'+exceptions+'</tbody></table>':'<p>Нет исключений в этом календаре.</p>')+'</div>'+
    '<div class="pv-calendar-section"><h3>Особые рабочие недели</h3>'+(weeks?'<table class="pv-resource-table"><thead><tr><th>Название</th><th>С</th><th>По</th></tr></thead><tbody>'+weeks+'</tbody></table>':'<p>Нет специальных рабочих недель.</p>')+'</div></div>';
}

export function mount(root, options={}) {
  if(!root) throw new Error('Project Viewer root not found');
  const app=options.app;
  const events=new AbortController();
  const prefs=(()=>{try{const x=JSON.parse(localStorage.getItem('ayyy:mpp:view')||'{}');return x&&typeof x==='object'?x:{};}catch{return {};}})();
  const allowedZoom=['day','week','month'],allowedSort=['id','name','start','finish','percent','duration'];
  const state={model:null,demo:false,filename:'',query:'',
    zoom:allowedZoom.includes(prefs.zoom)?prefs.zoom:'week',scrollZoom:allowedZoom.includes(prefs.zoom)?prefs.zoom:'week',
    sort:allowedSort.includes(prefs.sort)?prefs.sort:'id',scrollTop:0,scrollLeft:0,tableWidth:Number.isFinite(prefs.tableWidth)&&prefs.tableWidth>0?prefs.tableWidth:null,
    showLinks:prefs.showLinks!==false,showBaseline:prefs.showBaseline!==false,
    showCalendar:prefs.showCalendar!==false,showToday:prefs.showToday!==false,criticalOnly:false,
    tab:'gantt',calendarId:null,jumpDate:'',analysis:null,collapsed:new Set(),selectedUid:null,
    destroyed:false,pending:0,cancelParse:null};
  const savePrefs=()=>{
    try{localStorage.setItem('ayyy:mpp:view',JSON.stringify({
      zoom:state.zoom,sort:state.sort,tableWidth:state.tableWidth,showLinks:state.showLinks,
      showBaseline:state.showBaseline,showCalendar:state.showCalendar,showToday:state.showToday
    }));}catch{}
  };
  const sendStatus=(message='', kind='')=>{
    const el=root.querySelector('[data-pv-status]');
    if (el) {el.textContent=message;el.dataset.kind=kind;}
  };
  // Reuse the actual AYYY home-page wordmark, not a second visual approximation.
  const header = () => '<header class="pv-header"><a class="shore-brand pv-brand" href="#home" aria-label="AYYY — на главную">ayyy<span>.</span></a><span class="pv-header-separator"></span><strong>PROJECT VIEWER</strong><span class="pv-header-spacer"></span><a href="#directory" class="pv-back">Все сервисы</a><span class="pv-private"><span class="pv-private-dot"></span>Файл остаётся у вас</span></header>';
  const fileInput = () => '<input type="file" id="pv-file-input" accept=".mpp,.mpt,.mpx,.xml,application/xml" hidden>';
  const buttons = () => '<button type="button" class="pv-button pv-primary" data-pv-action="open">Открыть MPP / XML</button><button type="button" class="pv-button" data-pv-action="demo">Пример проекта</button>';
  const empty = () => '<div class="pv-empty"><div class="pv-empty-paper" aria-hidden="true"><i></i><i></i><i></i><i></i></div><div class="pv-kicker">БРАУЗЕРНЫЙ ПРОСМОТРЩИК ПРОЕКТОВ</div><h1>План проекта —<br>перед глазами.</h1><p>Откройте Microsoft Project (.mpp, .mpt, .mpx) или Project XML. Дерево задач, сроки и диаграмма Ганта будут построены в этом браузере.</p><div class="pv-empty-actions">'+buttons()+'</div><div class="pv-formats">Можно также перетащить файл сюда · Без регистрации и загрузки на сервер</div></div>';
  const taskInfo = t => {
    const fields = [
      ['ID / WBS',String(t.id)+' / '+(t.wbs||'—')],
      ['Сроки',dateText(t.start)+' — '+dateText(t.finish)],
      ['Базовый план',t.baselineStart!==null && t.baselineFinish!==null?dateText(t.baselineStart)+' — '+dateText(t.baselineFinish):'—'],
      ['Длительность',t.duration],
      ['Выполнение',numberLabel(t.percent)+'%'],
      ['Ресурсы',t.resourceNames||'—'],
      ['Предшественники',t.predecessorText||'—'],
      ['Последователи',t.successors.map(l=>state.model.byUid.get(l.to)?.id).filter(Boolean).join(', ')||'—'],
      ['Критическая задача',t.critical?'Да · из файла':state.analysis?.mode==='estimate'&&state.analysis.uids.has(t.uid)?'Приблизительная критическая цепочка':'Не подтверждена'],
      ['Общий резерв',t.totalSlack??'—'],
      ['Свободный резерв',t.freeSlack??'—'],
      ['Ограничение',t.constraint||'—'],
      ['Дата ограничения',dateText(t.constraintDate)],
      ['Тип планирования',t.manual?'Ручное':'Автоматическое']
    ];
    return '<aside class="pv-details" id="pv-details" aria-label="Сведения о задаче"><div class="pv-details-head"><strong>Сведения о задаче</strong><button type="button" data-pv-action="close-details" aria-label="Закрыть сведения">×</button></div><h2>'+escapeHtml(t.name)+'</h2><button class="pv-text-button pv-focus-task" type="button" data-pv-action="focus-task">Показать на диаграмме</button><dl>'+fields.map(([k,v])=>'<div><dt>'+escapeHtml(k)+'</dt><dd>'+escapeHtml(v)+'</dd></div>').join('')+'</dl>'+(t.notes?'<div class="pv-notes"><strong>Примечание</strong><p>'+escapeHtml(t.notes.slice(0,6000))+'</p></div>':'')+'</aside>';
  };
  // The task inspector occupies its own grid column; it never overlays Gantt bars.
  function refreshDetails() {
    const workspace=root.querySelector('.pv-workspace');
    if(!workspace)return;
    workspace.querySelector('#pv-details')?.remove();
    const task=state.model?.byUid.get(state.selectedUid);
    workspace.classList.toggle('pv-with-details',Boolean(task));
    if(task) workspace.insertAdjacentHTML('beforeend',taskInfo(task));
    if(state.tableWidth!==null) resizeTable(state.tableWidth,workspace);
    else updateSplitterA11y(workspace);
  }
  function splitBounds(workspace) {
    const splitter=workspace?.querySelector('.pv-splitter');
    if(!splitter || getComputedStyle(splitter).display==='none')return null;
    // On smaller screens the inspector moves BELOW the chart.
    const detailWidth=workspace.classList.contains('pv-with-details') && matchMedia('(min-width:1121px)').matches ? 300 : 0;
    const available=Math.max(0,workspace.clientWidth-detailWidth-8);
    const min=Math.min(340,Math.max(0,available-240));
    const max=Math.max(min,available-240);
    return {min,max};
  }
  function updateSplitterA11y(workspace) {
    const bounds=splitBounds(workspace), splitter=workspace?.querySelector('.pv-splitter');
    if(!bounds||!splitter)return;
    splitter.setAttribute('aria-valuemin',String(Math.round(bounds.min)));
    splitter.setAttribute('aria-valuemax',String(Math.round(bounds.max)));
    const width=workspace.querySelector('.pv-list-scroll').getBoundingClientRect().width;
    splitter.setAttribute('aria-valuenow',String(Math.round(width)));
  }
  function resizeTable(width,workspace=root.querySelector('.pv-workspace')) {
    const bounds=splitBounds(workspace);
    if(!bounds)return;
    state.tableWidth=Math.max(bounds.min,Math.min(bounds.max,Math.round(width)));
    workspace.style.setProperty('--pv-table-width',state.tableWidth+'px');
    savePrefs();
    updateSplitterA11y(workspace);
  }
  function installSplitter() {
    const workspace=root.querySelector('.pv-workspace');
    const splitter=workspace?.querySelector('.pv-splitter');
    if(!workspace || !splitter)return;
    if(state.tableWidth!==null)resizeTable(state.tableWidth,workspace);
    else updateSplitterA11y(workspace);
    let pointer=null;
    splitter.addEventListener('pointerdown',event=>{
      if(event.button!==0 || !splitBounds(workspace))return;
      pointer={id:event.pointerId,x:event.clientX,width:workspace.querySelector('.pv-list-scroll').getBoundingClientRect().width};
      splitter.setPointerCapture(event.pointerId);
      splitter.classList.add('is-dragging');
      event.preventDefault();
    },{signal:events.signal});
    splitter.addEventListener('pointermove',event=>{
      if(!pointer||event.pointerId!==pointer.id)return;
      resizeTable(pointer.width+event.clientX-pointer.x,workspace);
    },{signal:events.signal});
    const endResize=event=>{
      if(!pointer||event.pointerId!==pointer.id)return;
      if(splitter.hasPointerCapture(event.pointerId))splitter.releasePointerCapture(event.pointerId);
      pointer=null;
      splitter.classList.remove('is-dragging');
    };
    splitter.addEventListener('pointerup',endResize,{signal:events.signal});
    splitter.addEventListener('pointercancel',endResize,{signal:events.signal});
    splitter.addEventListener('lostpointercapture',()=>{pointer=null;splitter.classList.remove('is-dragging');},{signal:events.signal});
    splitter.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)||!splitBounds(workspace))return;
      event.preventDefault();
      const bounds=splitBounds(workspace);
      const current=workspace.querySelector('.pv-list-scroll').getBoundingClientRect().width;
      const target=event.key==='Home'?bounds.min:event.key==='End'?bounds.max:current+(event.key==='ArrowRight'?24:-24);
      resizeTable(target,workspace);
    },{signal:events.signal});
  }

  function render(resetScroll = false) {
    if(state.destroyed) return;
    const oldList=root.querySelector('#pv-list-scroll'), oldChart=root.querySelector('#pv-chart-scroll');
    if(!resetScroll && oldList && oldChart){
      state.scrollTop=oldList.scrollTop;
      state.scrollLeft=oldChart.scrollLeft;
    }
    const loaded=!!state.model;
    const model=state.model;
    const baseVisible=loaded?visibleTasks(model,state.query,state.collapsed,state.sort):[];
    let visible=baseVisible;
    if(loaded && state.criticalOnly && state.analysis?.uids.size){
      const included=new Set(state.analysis.uids);
      for(const uid of state.analysis.uids){
        let parent=model.byUid.get(uid)?.parent,guard=0;
        while(parent && guard++<60 && model.byUid.has(parent)){
          included.add(parent);parent=model.byUid.get(parent).parent;
        }
      }
      visible=baseVisible.filter(t=>included.has(t.uid));
    }
    const viewState=loaded?'<div class="pv-file-banner"><div><div class="pv-kicker">ОТКРЫТЫЙ ПРОЕКТ '+(state.demo?'· ДЕМО':'')+'</div><h1>'+escapeHtml(model.title)+'</h1><div class="pv-file-meta"><span>'+escapeHtml(state.filename)+'</span><span>'+escapeHtml(model.format||'Microsoft Project')+'</span><span>'+model.tasks.length+' задач</span><span>'+model.links.length+' связей</span><span>'+model.resources.length+' ресурсов</span></div></div><div class="pv-file-actions">'+buttons()+'<button type="button" class="pv-button" data-pv-action="export">CSV задач</button><button type="button" class="pv-button" data-pv-action="export-svg">SVG диаграммы</button></div></div>'+
      '<div class="pv-control-bar"><div class="pv-tabs" role="tablist"><button type="button" data-pv-tab="gantt" aria-selected="'+(state.tab==='gantt')+'">Гант / Задачи</button><button type="button" data-pv-tab="resources" aria-selected="'+(state.tab==='resources')+'">Ресурсы</button><button type="button" data-pv-tab="calendars" aria-selected="'+(state.tab==='calendars')+'">Календари</button></div><label class="pv-search"><span aria-hidden="true">⌕</span><input id="pv-search" type="search" placeholder="Поиск задач и ресурсов…" aria-label="Поиск" value="'+escapeHtml(state.query)+'"></label><div class="pv-chart-controls"><label>Сортировка <select id="pv-sort" aria-label="Сортировка задач"><option value="id"'+(state.sort==='id'?' selected':'')+'>WBS</option><option value="name"'+(state.sort==='name'?' selected':'')+'>Название</option><option value="start"'+(state.sort==='start'?' selected':'')+'>Начало</option><option value="finish"'+(state.sort==='finish'?' selected':'')+'>Окончание</option><option value="percent"'+(state.sort==='percent'?' selected':'')+'>Готовность</option></select></label><button type="button" class="pv-text-button" data-pv-action="expand">Развернуть</button><button type="button" class="pv-text-button" data-pv-action="collapse">Свернуть</button><label>Масштаб <select id="pv-zoom" aria-label="Масштаб диаграммы"><option value="day"'+(state.zoom==='day'?' selected':'')+'>День</option><option value="week"'+(state.zoom==='week'?' selected':'')+'>Неделя</option><option value="month"'+(state.zoom==='month'?' selected':'')+'>Месяц</option></select></label><button type="button" class="pv-toggle" data-pv-action="toggle-links" aria-pressed="'+state.showLinks+'">Связи</button><button type="button" class="pv-toggle" data-pv-action="toggle-baseline" aria-pressed="'+state.showBaseline+'">Базовый план</button><button type="button" class="pv-toggle" data-pv-action="toggle-calendar" aria-pressed="'+state.showCalendar+'">Нерабочие дни</button><button type="button" class="pv-toggle" data-pv-action="critical-only" aria-pressed="'+state.criticalOnly+'"'+(state.analysis?.mode==='none'?' disabled':'')+'>Критические</button><button type="button" class="pv-text-button" data-pv-action="today">Сегодня</button><label class="pv-jump"><input type="date" id="pv-jump-date" value="'+escapeHtml(state.jumpDate)+'" aria-label="Дата перехода"></label><button type="button" class="pv-text-button" data-pv-action="jump-date">Перейти</button></div></div>'+
      '<div class="pv-body">'+(state.tab==='resources'?resourceMarkup(model,state.query):state.tab==='calendars'?calendarMarkup(model,state.calendarId):
      '<div class="pv-workspace"><div class="pv-list-scroll" tabindex="0" aria-label="Таблица задач" id="pv-list-scroll"></div><div class="pv-splitter" role="separator" tabindex="0" aria-orientation="vertical" aria-label="Изменить ширину таблицы задач и диаграммы Ганта" aria-valuemin="340" aria-valuemax="950" aria-valuenow="550" title="Перетащите для изменения ширины. Клавиши ← и → тоже работают"><span aria-hidden="true"></span></div><div class="pv-chart-scroll" tabindex="0" aria-label="Диаграмма Ганта" id="pv-chart-scroll"></div></div>')+
      (state.tab==='gantt'&&state.analysis?'<p class="pv-analysis-note">Критическая цепочка: '+escapeHtml(state.analysis.mode==='source'?'по признакам из файла':state.analysis.mode==='estimate'?'приблизительная оценка':'данных недостаточно')+' · '+escapeHtml(state.analysis.reason)+'</p>':'')+
      (model.warnings.length?'<p class="pv-warning">Предупреждения при чтении файла: '+escapeHtml(model.warnings.slice(0,5).join('; '))+'</p>':'')+
      '<div class="pv-bottom"><span>Только чтение · Оригинальный файл не изменяется</span><span>'+visible.length+' из '+model.tasks.length+' задач</span></div></div>' : empty();
    root.innerHTML='<div class="pv-root">'+header()+'<main class="pv-main">'+viewState+'<div class="pv-message" data-pv-status role="status" aria-live="polite"></div></main>'+fileInput()+'</div>';
    if(loaded && state.tab==='gantt'){
      const list=root.querySelector('#pv-list-scroll');
      const timeline=root.querySelector('#pv-chart-scroll');
      const desiredTop=state.scrollTop;
      const desiredLeft=Math.round(state.scrollLeft*(zoomWidths[state.zoom]/zoomWidths[state.scrollZoom]));
      let lastStart=-1,lastEnd=-1,queued=false;
      const paint=(top=list.scrollTop)=>{
        if(state.destroyed || !list.isConnected || !timeline.isConnected)return;
        const viewport=rowWindow(visible.length,top,Math.max(100,list.clientHeight-44),rowHeight);
        if(viewport.start===lastStart && viewport.end===lastEnd)return;
        lastStart=viewport.start;lastEnd=viewport.end;
        const chart=ganttMarkup(visible,model,state.zoom,state.selectedUid,viewport,state.showLinks,state.showBaseline,{criticalIds:state.analysis?.uids,showCalendar:state.showCalendar,showToday:state.showToday,calendarId:state.calendarId||model.calendar});
        list.innerHTML=chart.left;
        timeline.innerHTML=chart.right;
        for(const node of list.querySelectorAll('[data-fold-icon]'))node.textContent=state.collapsed.has(node.dataset.foldIcon)?'▸':'▾';
      };
      paint(desiredTop);
      list.scrollTop=desiredTop;
      timeline.scrollTop=desiredTop;
      timeline.scrollLeft=desiredLeft;
      state.scrollTop=list.scrollTop;
      state.scrollLeft=timeline.scrollLeft;
      state.scrollZoom=state.zoom;
      // Both panes share the same row offset, but horizontal scrolling is independent.
      let syncing=false;
      const sync=(from,to)=>{
        if(syncing)return;
        syncing=true;
        to.scrollTop=from.scrollTop;
        syncing=false;
        state.scrollTop=from.scrollTop;
        state.scrollLeft=timeline.scrollLeft;
        if(!queued){
          queued=true;
          requestAnimationFrame(()=>{
            queued=false;
            if(list.isConnected)paint(list.scrollTop);
          });
        }
      };
      list.addEventListener('scroll',()=>sync(list,timeline),{signal:events.signal});
      timeline.addEventListener('scroll',()=>sync(timeline,list),{signal:events.signal});
    }
    const controls=root.querySelector('.pv-chart-controls');
    if(controls)controls.hidden=state.tab!=='gantt';
    if(loaded && state.tab==='gantt'){
      refreshDetails();
      installSplitter();
    }
    if (state.demo) sendStatus('Демонстрационный проект: все данные вымышлены. Это не прочитанный MPP-файл.','info');
  }
  function readInWorker(bytes, filename) {
    return new Promise((resolve,reject)=>{
      let worker;
      try {
        worker=new Worker(new URL('./reader-worker.mjs',import.meta.url),{type:'module'});
      } catch(error) {
        reject(Object.assign(new Error('Невозможно запустить Web Worker.'),{code:'worker',cause:error}));
        return;
      }
      let timer;
      const finish=()=>{
        clearTimeout(timer);
        worker.terminate();
        if(state.cancelParse===cancel)state.cancelParse=null;
      };
      const fail=(message,code='worker')=>{
        finish();
        reject(Object.assign(new Error(String(message)),{code}));
      };
      const cancel=()=>fail('Чтение отменено','cancelled');
      state.cancelParse=cancel;
      worker.onmessage=event=>{
        const data=event.data;
        if(!data?.ok){fail(data?.error||'Ошибка чтения файла.',data?.code||'format');return;}
        finish();
        const model=data.model;
        model.byUid=new Map(model.tasks.map(task=>[task.uid,task]));
        resolve(model);
      };
      worker.onerror=event=>{
        event.preventDefault();
        fail('Ошибка загрузки браузерного парсера.','worker');
      };
      timer=setTimeout(()=>fail('Чтение превысило 45 секунд.','timeout'),45000);
      try {worker.postMessage({bytes,filename},[bytes]);}
      catch(error){fail(error?.message||'Ошибка запуска чтения.','worker');}
    });
  }
  async function parseLocalFile(file,ticket){
    const bytes=await file.arrayBuffer();
    if(state.destroyed||ticket!==state.pending)throw Object.assign(new Error('Чтение отменено'),{code:'cancelled'});
    if(typeof Worker==='function'){
      try {return await readInWorker(bytes,file.name);}
      catch(error) {
        if(error?.code!=='worker')throw error;
        console.warn('AYYY Project Viewer: worker unavailable, falling back to direct read',error);
      }
    }
    const fallback=bytes.byteLength?bytes:await file.arrayBuffer();
    const reader=await loadParser();
    if(state.destroyed||ticket!==state.pending)throw Object.assign(new Error('Чтение отменено'),{code:'cancelled'});
    return normalizeProject(reader.readProject(new Uint8Array(fallback)),file.name);
  }

  async function openFile(file) {
    if(!file) return;
    const extension=file.name.split('.').pop()?.toLowerCase() || '';
    if(!['mpp','mpt','mpx','xml'].includes(extension)){sendStatus('Выберите .mpp, .mpt, .mpx или .xml файл.','error');return;}
    if(file.size>40*1024*1024){sendStatus('Файл больше 40 МБ. Для первой версии установлен лимит безопасности.','error');return;}
    if(file.size===0){sendStatus('Файл пустой.','error');return;}
    const ticket=++state.pending;
    state.cancelParse?.();
    sendStatus('Открываем '+file.name+' локально…','working');
    root.classList.add('pv-busy');
    try{
      const normalized=await parseLocalFile(file,ticket);
      if(state.destroyed||ticket!==state.pending)return;
      state.model=normalized;state.analysis=criticalChain(normalized);state.calendarId=normalized.calendar;state.demo=false;state.filename=file.name;state.query='';state.scrollTop=0;state.scrollLeft=0;state.criticalOnly=false;state.tab='gantt';state.selectedUid=null;state.collapsed.clear();
      render(true);
      sendStatus('Файл прочитан локально. Ничего не отправлено на сервер.','success');
    }catch(error){
      if(state.destroyed||ticket!==state.pending)return;
      const kind=error?.code;
      const hint=kind==='timeout'?'Время чтения истекло: попробуйте экспортировать Project XML или открыть проект меньшего размера.':kind==='password'?'Файл защищён паролем. Снимите защиту в Microsoft Project или экспортируйте в XML.':kind==='version'?'Эта версия MPP не поддержана парсером. Попробуйте экспорт Project XML.':'Проверьте файл. Если формат MPP не поддерживается, попробуйте экспорт в Project XML.';
      sendStatus('Не удалось открыть '+file.name+': '+String(error?.message||error)+'. '+hint,'error');
      console.warn('AYYY Project Viewer: parse failed',error);
    }finally{
      if(!state.destroyed&&ticket===state.pending)root.classList.remove('pv-busy');
    }
  }
  function jumpToDate(value) {
    const when=dateValue(value);
    const chart=root.querySelector('#pv-chart-scroll');
    if(!chart || when===null) {sendStatus('Укажите корректную дату в календаре.','error');return;}
    const range=timelineRange(state.model);
    if(when<range.start || when>range.start+range.days*DAY) {
      sendStatus('Указанная дата вне диапазона задач проекта.','info');return;
    }
    chart.scrollLeft=Math.max(0,Math.round((when-range.start)/DAY*zoomWidths[state.zoom]-chart.clientWidth*.3));
    state.scrollLeft=chart.scrollLeft;
    sendStatus('Диаграмма перемещена к '+dateText(when)+'.','success');
  }
  function focusSelectedTask() {
    const task=state.model?.byUid.get(state.selectedUid);
    if(!task)return;
    let visible=visibleTasks(state.model,state.query,state.collapsed,state.sort);
    if(!visible.some(t=>t.uid===task.uid) || state.criticalOnly) {
      state.query='';state.collapsed.clear();state.criticalOnly=false;
      render();visible=visibleTasks(state.model,'',state.collapsed,state.sort);
    }
    const index=visible.findIndex(t=>t.uid===task.uid),list=root.querySelector('#pv-list-scroll');
    const chart=root.querySelector('#pv-chart-scroll');
    if(index<0 || !list || !chart)return;
    list.scrollTop=Math.max(0,index*rowHeight-list.clientHeight/2+44);
    chart.scrollTop=list.scrollTop;
    if(task.start!==null)jumpToDate(task.start);
    state.scrollTop=list.scrollTop;
    selectTask(task.uid);
  }
  function exportSvg() {
    if(!state.model || !app?.download)return;
    const model=state.model;
    let tasks=visibleTasks(model,state.query,state.collapsed,state.sort);
    if(state.criticalOnly && state.analysis?.uids.size){
      const keep=new Set(state.analysis.uids);
      for(const uid of state.analysis.uids){
        let p=model.byUid.get(uid)?.parent,guard=0;
        while(p && guard++<60 && model.byUid.has(p)){keep.add(p);p=model.byUid.get(p).parent;}
      }
      tasks=tasks.filter(t=>keep.has(t.uid));
    }
    try {
      const svg=ganttSvg(model,tasks,{zoom:state.zoom,criticalIds:state.analysis?.uids,showBaseline:state.showBaseline,
        showCalendar:state.showCalendar,showLinks:state.showLinks,showToday:state.showToday});
      const name=(state.filename||'project').replace(/\.[^.]+$/,'').replace(/[\/\\:*?"<>|]/g,'_').slice(0,70)||'project';
      app.download(name+'-gantt.svg',svg,'image/svg+xml;charset=utf-8');
      sendStatus('SVG-диаграмма сохранена локально. Оригинальный MPP не изменился.','success');
    } catch(error) {sendStatus(String(error?.message||error),'error');}
  }

  function selectTask(uid) {
    if(!state.model?.byUid.has(uid))return;
    state.selectedUid=uid;
    for(const element of root.querySelectorAll('[data-pv-task]')){
      const selected=element.dataset.pvTask===uid;
      element.classList.toggle('is-selected',selected);
      element.setAttribute('aria-selected',String(selected));
    }
    refreshDetails();
  }
  function renderDemo() {
    ++state.pending;
    state.cancelParse?.();
    state.model=demoProject();state.analysis=criticalChain(state.model);state.calendarId=state.model.calendar;state.filename='Пример (вымышленный)';state.demo=true;
    state.query='';state.zoom='week';state.scrollZoom='week';state.scrollTop=0;state.scrollLeft=0;state.tab='gantt';state.selectedUid=null;state.collapsed.clear();render(true);
  }
  function exportCsv() {
    if(!state.model || !app?.download)return;
    const basename=(state.filename||'project').replace(/\.[^.]+$/,'').replace(/[\/\\:*?"<>|]/g,'_').slice(0,70)||'project';
    app.download(basename+'-tasks.csv',tasksCsv(state.model),'text/csv;charset=utf-8');
    sendStatus('CSV создан в браузере.','success');
  }

  root.addEventListener('click',event=>{
    const control=event.target.closest('[data-pv-action], [data-pv-tab], [data-pv-fold], [data-pv-task], [data-pv-calendar]');
    if(!control || !root.contains(control))return;
    const action=control.dataset.pvAction;
    if(action==='open'){root.querySelector('#pv-file-input')?.click();return;}
    if(action==='demo'){renderDemo();return;}
    if(action==='export'){exportCsv();return;}
    if(action==='export-svg'){exportSvg();return;}
    if(action==='today'){jumpToDate(todayStamp());return;}
    if(action==='jump-date'){jumpToDate(state.jumpDate);return;}
    if(action==='focus-task'){focusSelectedTask();return;}
    if(action==='toggle-calendar'){state.showCalendar=!state.showCalendar;savePrefs();render();return;}
    if(action==='critical-only'){
      if(!state.analysis?.uids.size)return;
      state.criticalOnly=!state.criticalOnly;state.collapsed.clear();state.scrollTop=0;render(true);return;
    }
    if(action==='toggle-links'){state.showLinks=!state.showLinks;savePrefs();render();return;}
    if(action==='toggle-baseline'){state.showBaseline=!state.showBaseline;savePrefs();render();return;}
    if(action==='close-details'){state.selectedUid=null;refreshDetails();root.querySelectorAll('.is-selected').forEach(el=>{el.classList.remove('is-selected');el.setAttribute('aria-selected','false');});return;}
    if(action==='expand'){state.collapsed.clear();render();return;}
    if(action==='collapse'){state.collapsed=new Set(state.model?.tasks.filter(t=>t.children).map(t=>t.uid)||[]);render();return;}
    if(control.dataset.pvTab){state.tab=control.dataset.pvTab;state.selectedUid=null;render();return;}
    if(control.dataset.pvCalendar){state.calendarId=control.dataset.pvCalendar;render();return;}
    if(control.dataset.pvFold){
      const id=control.dataset.pvFold;
      if(state.collapsed.has(id))state.collapsed.delete(id);else state.collapsed.add(id);
      render();return;
    }
    if(control.dataset.pvTask)selectTask(control.dataset.pvTask);
  },{signal:events.signal});
  root.addEventListener('change',event=>{
    if(event.target?.id==='pv-file-input'){
      const file=event.target.files?.[0];event.target.value='';
      openFile(file);
    }
    if(event.target?.id==='pv-zoom'){state.zoom=event.target.value in zoomWidths?event.target.value:'week';savePrefs();render();}
    if(event.target?.id==='pv-sort'){state.sort=allowedSort.includes(event.target.value)?event.target.value:'id';state.scrollTop=0;savePrefs();render(true);}
    if(event.target?.id==='pv-jump-date'){state.jumpDate=event.target.value;}
  },{signal:events.signal});
  root.addEventListener('input',event=>{
    if(event.target?.id!=='pv-search')return;
    const value=event.target.value;
    const caret=event.target.selectionStart;
    state.query=value;render();
    const search=root.querySelector('#pv-search');
    if(search){search.focus();try{search.setSelectionRange(caret,caret);}catch{}}
  },{signal:events.signal});
  root.addEventListener('dragover',event=>{if(!event.dataTransfer?.types.includes('Files'))return;event.preventDefault();root.classList.add('pv-dragging');},{signal:events.signal});
  root.addEventListener('dragleave',event=>{if(!root.contains(event.relatedTarget))root.classList.remove('pv-dragging');},{signal:events.signal});
  root.addEventListener('drop',event=>{
    if(!event.dataTransfer?.files?.length)return;
    event.preventDefault();root.classList.remove('pv-dragging');
    openFile(event.dataTransfer.files[0]);
  },{signal:events.signal});
  render();
  return {destroy(){state.destroyed=true;state.pending++;state.cancelParse?.();events.abort();root.replaceChildren();}};
}
