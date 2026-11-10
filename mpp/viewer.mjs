/* AYYY Project Viewer — local-only Microsoft Project plan reader and Gantt UI. */
import {DAY, dateText, normalizeProject, visibleTasks, timelineRange, rowWindow, dependencyLines, tasksCsv, demoProject} from './model.mjs';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const zoomWidths = {day:26,week:12,month:5};
const rowHeight = 34;
let parserPromise = null;
const loadParser = () => parserPromise ||= import('./vendor/mpxj-ts/mpxj.mjs').catch(error => {parserPromise = null; throw error;});
const numberLabel = value => Number.isFinite(Number(value)) ? new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(value) : '—';
const dateAt = ms => new Date(ms);
const monthName = date => new Intl.DateTimeFormat('ru-RU',{month:'long',year:'numeric',timeZone:'UTC'}).format(date);
const shortDay = date => new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',timeZone:'UTC'}).format(date);
const className = task => task.milestone?'pv-milestone':task.summary?'pv-summary':task.critical?'pv-critical':'pv-ordinary';

function ganttMarkup(tasks, model, zoom, selectedUid, viewport, showLinks = true, showBaseline = true) {
  const range = timelineRange(model), pixel = zoomWidths[zoom] || zoomWidths.week;
  const width = Math.round(range.days * pixel);
  const end = range.start + range.days * DAY;
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
  const steps = zoom==='day'?1:zoom==='week'?7:30;
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
          bar='<span class="pv-task-bar '+className(task)+'" style="left:'+Math.max(0,left)+'px;width:'+size+'px" title="'+tooltip+'">'+
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
  return {
    left:'<div class="pv-list-head"><span>Задача / WBS</span><span>Начало</span><span>Окончание</span><span>Длит.</span><span>Готово</span></div><div class="pv-list-rows">'+before+leftRows.join('')+after+'</div>',
    right:'<div class="pv-chart-head" style="width:'+width+'px"><div class="pv-months">'+months.join('')+'</div><div class="pv-ticks">'+ticks.join('')+'</div></div>'+
      '<div class="pv-chart-rows" style="width:'+width+'px">'+before+rightRows.join('')+after+connectors+'</div>'
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

export function mount(root, options={}) {
  if(!root) throw new Error('Project Viewer root not found');
  const app=options.app;
  const events=new AbortController();
  const state={model:null, demo:false, filename:'', query:'', zoom:'week', scrollZoom:'week', scrollTop:0, scrollLeft:0, showLinks:true, showBaseline:true, tab:'gantt', collapsed:new Set(), selectedUid:null, destroyed:false, pending:0, cancelParse:null};
  const sendStatus=(message='', kind='')=>{
    const el=root.querySelector('[data-pv-status]');
    if (el) {el.textContent=message;el.dataset.kind=kind;}
  };
  const header = () => '<header class="pv-header"><a class="pv-brand" href="#home" aria-label="AYYY — на главную">ayyy<span>.</span></a><span class="pv-header-separator"></span><strong>PROJECT VIEWER</strong><span class="pv-header-spacer"></span><a href="#directory" class="pv-back">Все сервисы</a><span class="pv-private"><span class="pv-private-dot"></span>Файл остаётся у вас</span></header>';
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
      ['Критическая задача',t.critical?'Да':'Нет']
    ];
    return '<aside class="pv-details" id="pv-details" aria-label="Сведения о задаче"><div class="pv-details-head"><strong>Сведения о задаче</strong><button type="button" data-pv-action="close-details" aria-label="Закрыть сведения">×</button></div><h2>'+escapeHtml(t.name)+'</h2><dl>'+fields.map(([k,v])=>'<div><dt>'+escapeHtml(k)+'</dt><dd>'+escapeHtml(v)+'</dd></div>').join('')+'</dl>'+(t.notes?'<div class="pv-notes"><strong>Примечание</strong><p>'+escapeHtml(t.notes.slice(0,6000))+'</p></div>':'')+'</aside>';
  };
  function render(resetScroll = false) {
    if(state.destroyed) return;
    const oldList=root.querySelector('#pv-list-scroll'), oldChart=root.querySelector('#pv-chart-scroll');
    if(!resetScroll && oldList && oldChart){
      state.scrollTop=oldList.scrollTop;
      state.scrollLeft=oldChart.scrollLeft;
    }
    const loaded=!!state.model;
    const model=state.model;
    const visible=loaded?visibleTasks(model,state.query,state.collapsed):[];
    const viewState=loaded?'<div class="pv-file-banner"><div><div class="pv-kicker">ОТКРЫТЫЙ ПРОЕКТ '+(state.demo?'· ДЕМО':'')+'</div><h1>'+escapeHtml(model.title)+'</h1><div class="pv-file-meta"><span>'+escapeHtml(state.filename)+'</span><span>'+escapeHtml(model.format||'Microsoft Project')+'</span><span>'+model.tasks.length+' задач</span><span>'+model.links.length+' связей</span><span>'+model.resources.length+' ресурсов</span></div></div><div class="pv-file-actions">'+buttons()+'<button type="button" class="pv-button" data-pv-action="export">CSV задач</button></div></div>'+
      '<div class="pv-control-bar"><div class="pv-tabs" role="tablist"><button type="button" data-pv-tab="gantt" aria-selected="'+(state.tab==='gantt')+'">Гант / Задачи</button><button type="button" data-pv-tab="resources" aria-selected="'+(state.tab==='resources')+'">Ресурсы</button></div><label class="pv-search"><span aria-hidden="true">⌕</span><input id="pv-search" type="search" placeholder="Поиск задач и ресурсов…" aria-label="Поиск" value="'+escapeHtml(state.query)+'"></label><div class="pv-chart-controls"><button type="button" class="pv-text-button" data-pv-action="expand">Развернуть</button><button type="button" class="pv-text-button" data-pv-action="collapse">Свернуть</button><label>Масштаб <select id="pv-zoom" aria-label="Масштаб диаграммы"><option value="day"'+(state.zoom==='day'?' selected':'')+'>День</option><option value="week"'+(state.zoom==='week'?' selected':'')+'>Неделя</option><option value="month"'+(state.zoom==='month'?' selected':'')+'>Месяц</option></select></label><button type="button" class="pv-toggle" data-pv-action="toggle-links" aria-pressed="'+state.showLinks+'">Связи</button><button type="button" class="pv-toggle" data-pv-action="toggle-baseline" aria-pressed="'+state.showBaseline+'">Базовый план</button></div></div>'+
      '<div class="pv-body">'+(state.tab==='resources'?resourceMarkup(model,state.query):
      '<div class="pv-workspace"><div class="pv-list-scroll" tabindex="0" aria-label="Таблица задач" id="pv-list-scroll"></div><div class="pv-chart-scroll" tabindex="0" aria-label="Диаграмма Ганта" id="pv-chart-scroll"></div></div>')+
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
        const viewport=rowWindow(visible.length,top,Math.max(100,list.clientHeight-56),rowHeight);
        if(viewport.start===lastStart && viewport.end===lastEnd)return;
        lastStart=viewport.start;lastEnd=viewport.end;
        const chart=ganttMarkup(visible,model,state.zoom,state.selectedUid,viewport,state.showLinks,state.showBaseline);
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
    const task=state.model?.byUid.get(state.selectedUid);
    if(task && state.tab==='gantt')root.querySelector('.pv-body').insertAdjacentHTML('beforeend',taskInfo(task));
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
      timer=setTimeout(()=>fail('Чтение превысило 45 секунд.','worker'),45000);
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
      state.model=normalized;state.demo=false;state.filename=file.name;state.query='';state.scrollTop=0;state.scrollLeft=0;state.tab='gantt';state.selectedUid=null;state.collapsed.clear();
      render(true);
      sendStatus('Файл прочитан локально. Ничего не отправлено на сервер.','success');
    }catch(error){
      if(state.destroyed||ticket!==state.pending)return;
      const kind=error?.code;
      const hint=kind==='password'?'Файл защищён паролем. Снимите защиту в Microsoft Project или экспортируйте в XML.':kind==='version'?'Эта версия MPP не поддержана парсером. Попробуйте экспорт Project XML.':'Проверьте файл. Если формат MPP не поддерживается, попробуйте экспорт в Project XML.';
      sendStatus('Не удалось открыть '+file.name+': '+String(error?.message||error)+'. '+hint,'error');
      console.warn('AYYY Project Viewer: parse failed',error);
    }finally{
      if(!state.destroyed&&ticket===state.pending)root.classList.remove('pv-busy');
    }
  }
  function selectTask(uid) {
    if(!state.model?.byUid.has(uid))return;
    state.selectedUid=uid;
    for(const element of root.querySelectorAll('[data-pv-task]')){
      const selected=element.dataset.pvTask===uid;
      element.classList.toggle('is-selected',selected);
      element.setAttribute('aria-selected',String(selected));
    }
    root.querySelector('#pv-details')?.remove();
    root.querySelector('.pv-body')?.insertAdjacentHTML('beforeend',taskInfo(state.model.byUid.get(uid)));
  }
  function renderDemo() {
    ++state.pending;
    state.cancelParse?.();
    state.model=demoProject();state.filename='Пример (вымышленный)';state.demo=true;
    state.query='';state.zoom='week';state.scrollZoom='week';state.scrollTop=0;state.scrollLeft=0;state.tab='gantt';state.selectedUid=null;state.collapsed.clear();render(true);
  }
  function exportCsv() {
    if(!state.model || !app?.download)return;
    const basename=(state.filename||'project').replace(/\.[^.]+$/,'').replace(/[\/\\:*?"<>|]/g,'_').slice(0,70)||'project';
    app.download(basename+'-tasks.csv',tasksCsv(state.model),'text/csv;charset=utf-8');
    sendStatus('CSV создан в браузере.','success');
  }

  root.addEventListener('click',event=>{
    const control=event.target.closest('[data-pv-action], [data-pv-tab], [data-pv-fold], [data-pv-task]');
    if(!control || !root.contains(control))return;
    const action=control.dataset.pvAction;
    if(action==='open'){root.querySelector('#pv-file-input')?.click();return;}
    if(action==='demo'){renderDemo();return;}
    if(action==='export'){exportCsv();return;}
    if(action==='toggle-links'){state.showLinks=!state.showLinks;render();return;}
    if(action==='toggle-baseline'){state.showBaseline=!state.showBaseline;render();return;}
    if(action==='close-details'){state.selectedUid=null;root.querySelector('#pv-details')?.remove();root.querySelectorAll('.is-selected').forEach(el=>{el.classList.remove('is-selected');el.setAttribute('aria-selected','false');});return;}
    if(action==='expand'){state.collapsed.clear();render();return;}
    if(action==='collapse'){state.collapsed=new Set(state.model?.tasks.filter(t=>t.children).map(t=>t.uid)||[]);render();return;}
    if(control.dataset.pvTab){state.tab=control.dataset.pvTab;state.selectedUid=null;render();return;}
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
    if(event.target?.id==='pv-zoom'){state.zoom=event.target.value in zoomWidths?event.target.value:'week';render();}
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
