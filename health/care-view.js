/* HUMAN care layout using local encrypted records. */
(() => {
 'use strict';
 const V=window.HumanView,H=window.HumanHealth,C=window.HumanCare,M=window.HumanModel,h=V.h;
 const zone=doc=>H.zoneName(doc.profile.timezone);
 const at=(value,tz)=>value?new Date(value).toLocaleString('ru-RU',{timeZone:tz}):'Не назначено';
 const outcome=r=>r.outcome==='taken'?'Принял(а)':'Пропуск';
 const operations={edit:'Исправлено',delete:'Удалено',schedule_changed:'Расписание изменено',done:'Выполнено',skipped:'Пропущено',snooze:'Отложено',toggle:'Включение / пауза'};
 function medicineField(x,doc,optional){
  const choices=[['',optional?'Без препарата':'Выберите препарат'],...doc.medications.map(r=>[r.id,M.clinical(r,'medication').name])];
  if(x.medication_id&&!choices.some(r=>r[0]===x.medication_id))choices.push([x.medication_id,(x.medication_name||'Прежний препарат')+' · удалён']);
  return V.field(optional?'Препарат (необязательно)':'Препарат','medication_id',x.medication_id||'','select',choices);
 }
 function fields(kind,x,doc){
  const f=V.field,r=V.row,tz=zone(doc),initial=H.localInput(x.occurred_at||new Date(),tz);
  if(kind==='intake')return [medicineField(x,doc,false),r(f('Событие','outcome',x.outcome||'taken','select',[['taken','Принял(а)'],['skipped','Пропустил(а)']]),f('Время приёма или пропуска','at',initial,'datetime-local',null,true)),
   h('div',{'data-care-field':'dose'},f('Фактическая доза, если известна','dose',x.dose||'')),f('Примечание к событию','notes',x.notes||'','textarea'),h('small',{class:'health-muted'},'Время: '+tz+'. Плановая доза препарата сохраняется отдельно.'),h('details',{},h('summary',{},'Уточнить время'),f('Смещение UTC','offset',''))];
  const next=H.localInput(new Date(Date.now()+3600000),tz);
  return [r(f('О чём напомнить','title',x.title||'','text',null,true),f('Повторение','frequency',x.frequency||'once','select',[['once','Один раз'],['daily','Каждый день']])),
   r(f('Дата / начало расписания','date',x.date||next.slice(0,10),'date',null,true),f('Местное время','time',x.time||next.slice(11,16),'time',null,true)),f('Часовой пояс напоминания','timezone',x.timezone||tz,'text',null,true),
   h('div',{'data-care-field':'daily'},f('Окончание расписания (необязательно)','until_date',x.until_date||'','date')),
   medicineField(x,doc,true),f('Примечание к напоминанию','notes',x.notes||'','textarea'),h('label',{class:'care-checkbox'},h('input',{name:'enabled',type:'checkbox',checked:x.enabled!==false}), 'Напоминание включено'),
   h('small',{'data-care-field':'daily',class:'health-muted'},'При переводе часов отсутствующее время пропускается, повторяющееся срабатывает один раз — в ранний момент.'),
   h('details',{'data-care-field':'once'},h('summary',{},'Уточнить время при переводе часов'),f('Смещение UTC напоминания','utc_offset',x.utc_offset||''))];
 }
 function updateForm(form){
  const kind=form.dataset.kind,mode=kind==='intake'?form.elements.outcome.value:form.elements.frequency.value;
  for(const box of form.querySelectorAll('[data-care-field]')){box.hidden=box.dataset.careField==='dose'?mode!=='taken':box.dataset.careField!==mode;for(const input of box.querySelectorAll('input,select,textarea'))input.disabled=box.hidden;}
 }
 function rowActions(kind,r){return h('div',{class:'actions'},V.button('Исправить','edit',{'data-kind':kind,'data-id':r.id}),V.button('История','care-history',{'data-kind':kind,'data-id':r.id}),V.button('Удалить','remove',{'data-kind':kind,'data-id':r.id}));}
 function history(doc,kind,id){
  const tz=zone(doc),out=h('div',{class:'care-history'}),rows=doc.revisions.filter(x=>x.recordId===id).slice().reverse();
  if(!rows.length)out.append(V.empty('Исправлений пока нет.'));
  for(const revision of rows){const r=revision.previous||{},action=revision.operation;out.append(h('div',{},h('strong',{},operations[action]||action||'Изменение'),h('small',{},at(revision.changedAt,tz)),h('p',{},kind==='intake'?[r.medication_name,outcome(r),r.dose,at(r.occurred_at,tz)].filter(Boolean).join(' · '):[r.title,r.enabled?'Включено':'Выключено',r.frequency==='daily'?'Ежедневно':'Один раз',r.time,r.timezone,at(r.next_due_at,r.timezone||tz)].join(' · ')),h('p',{class:'preserve'},r.notes||'')));}
  return out;
 }
 function page(state){
  const doc=state.doc,view=state.careView||'intakes',kind=view==='intakes'?'intake':'reminder',med=state.careMedication||'',tz=zone(doc),root=h('div',{},V.title('Приёмы и напоминания','Ваши записи событий и расписания.'));
  const page=h('div',{class:'care-page'});root.append(page);
  page.append(h('div',{class:'care-tabs',role:'group','aria-label':'Приёмы и напоминания'},[['intakes','Приёмы и пропуски'],['reminders','Напоминания']].map(([value,label])=>V.button(label,'care-view',{'data-view':value,'aria-pressed':String(view===value)})),med?V.button('Показать все препараты','care-all'):null));
  page.append(h('div',{class:'care-section-heading'},h('div',{},h('h2',{},kind==='intake'?'Фактические приёмы и пропуски':'Мои напоминания'),h('small',{class:'health-muted'},kind==='intake'?'Введённые вами события. План приёма — в карточке препарата.':'Выполнение напоминания отмечается отдельно от факта приёма.')),V.button(kind==='intake'?'Записать событие':'Новое напоминание','new-'+kind,{class:'primary','data-medication':med})));
  if(kind==='reminder')page.append(h('details',{class:'care-notification-options'},h('summary',{},'Уведомления · '+(doc.carePreferences?.browser_enabled?'включены':'внутри HUMAN')),h('p',{},'Напоминания обновляются, пока HUMAN открыт и журнал разблокирован. При закрытом сайте уведомления не доставляются.'),h('p',{},'Браузерное уведомление содержит общий текст без названия препарата и медицинских данных.'),V.button(doc.carePreferences?.browser_enabled?'Выключить браузерные уведомления':'Включить браузерные уведомления','care-notifications')));
  const all=C.records(doc,kind).filter(r=>!med||r.medication_id===med),filter=state.careFilter||'all',rows=all.filter(r=>kind==='intake'||filter==='all'||(filter==='due'?C.due(r):filter==='active'?r.enabled:!r.enabled));
  const list=V.card(null);list.classList.add('care-list');page.append(list);
  const filterBox=h('div',{class:'care-filters'});if(kind==='reminder'){const choice=V.field('Показывать напоминания','careFilter',filter,'select',[['all','Все'],['due','Пора выполнить'],['active','Включённые'],['paused','Выключенные']]);choice.querySelector('select').dataset.careFilter='yes';filterBox.append(choice);}filterBox.append(h('small',{class:'health-muted'},'Найдено: '+rows.length));list.append(filterBox);
  const offset=Math.max(0,Math.min(state.careOffset||0,Math.floor(Math.max(0,rows.length-1)/50)*50)),slice=rows.slice(offset,offset+50);
  if(!slice.length){list.append(V.empty(kind==='intake'?'Событий пока нет.':'Напоминаний в этом списке нет.'));return root;}
  const labels=kind==='intake'?['Дата и время','Препарат','Событие','Фактическая доза','Примечание','Действия']:['Напоминание','Расписание','Следующее','Действия'];
  const table=V.table(labels,slice.map(r=>{
   if(kind==='intake')return [at(r.occurred_at,tz),h('div',{},h('strong',{},r.medication_name),h('small',{},'Ручной ввод')),h('span',{class:'care-tag '+r.outcome},outcome(r)),r.outcome==='skipped'?'—':r.dose||'Не указана',h('span',{class:'preserve'},r.notes||'—'),rowActions(kind,r)];
   const due=C.due(r),actions=rowActions(kind,r);
   if(due)actions.prepend(...[['done','Выполнено'],['snooze','Отложить'],['skipped','Пропустить']].map(([action,label])=>V.button(label,'care-act',{'data-id':r.id,'data-version':r.version,'data-mode':action})));
   if(r.medication_id&&doc.medications.some(m=>m.id===r.medication_id))actions.append(V.button('Записать приём','new-intake',{'data-medication':r.medication_id}));
   actions.append(V.button(r.enabled?'Пауза':'Включить','care-toggle',{'data-id':r.id,'data-version':r.version}));
   return [h('div',{},h('strong',{},r.title),r.medication_name?h('small',{},r.medication_name):null,h('small',{},r.enabled?due?'Пора выполнить':'Включено':'Выключено')),h('div',{},(r.frequency==='daily'?'Ежедневно':'Один раз')+' · '+r.time,h('small',{},r.timezone+(r.until_date?' · до '+V.date(r.until_date):''))),h('div',{},at(r.next_due_at,r.timezone),r.notes?h('small',{class:'preserve'},r.notes):null),actions];
  }));
  table.classList.add('table-wrap');Array.from(table.querySelectorAll('tbody tr')).forEach((tr,i)=>{if(kind==='reminder'&&C.due(slice[i]))tr.classList.add('care-due');Array.from(tr.children).forEach((td,j)=>td.setAttribute('data-label',labels[j]));});list.append(table);
  if(rows.length>50)list.append(h('div',{class:'actions care-pagination'},V.button('Назад','care-page',{'data-offset':Math.max(0,offset-50),disabled:!offset}),h('span',{},(offset+1)+'–'+(offset+slice.length)),V.button('Далее','care-page',{'data-offset':offset+50,disabled:offset+50>=rows.length})));
  return root;
 }
 window.HumanCareView={fields,updateForm,page,history};
})();
