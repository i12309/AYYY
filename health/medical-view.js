/* HUMAN medical-card layout over the encrypted browser journal. */
(() => {
 'use strict';
 const V=window.HumanView,M=window.HumanModel,h=V.h;
 const labels={allergy:'Аллергии и реакции',medication:'Лекарства и добавки',vaccine:'Прививки',condition:'Хронические состояния',surgery:'Операции',other:'Другие сведения'};
 const statuses={unknown:'Не указан',active:'Актуально',inactive:'Неактуально',planned:'Запланировано',paused:'Пауза',completed:'Завершено',remission:'Ремиссия',resolved:'Завершилось'};
 const severity={unknown:'Не указана',mild:'Лёгкая',moderate:'Умеренная',severe:'Тяжёлая'};
 const statusName=c=>c.category==='medication'&&c.status==='active'?'Принимаю':c.category==='vaccine'?'Введена':statuses[c.status]||c.status;
 const period=c=>V.date(c.start.value)+(c.end.value?' — '+V.date(c.end.value):'');
 function summary(c){if(c.category==='allergy')return c.allergy.reaction||'Реакция не описана';if(c.category==='medication')return [c.medication.dose,c.medication.schedule].filter(Boolean).join(' · ')||'Доза и режим не указаны';if(c.category==='vaccine')return [c.vaccination.against,c.vaccination.dose_label].filter(Boolean).join(' · ');return c.condition.description||'';}
 function episodes(doc){return window.HumanHealth.episodes(doc);}
 function fields(kind,item,doc){
  const c=M.clinical(item,kind),f=V.field,r=V.row,parts=[];
  if(kind==='medical')parts.push(f('Категория','category',c.category,'select',Object.entries(labels).filter(([key])=>key!=='medication')));
  parts.push(f(kind==='medication'?'Название препарата':'Название',''+(kind==='medication'?'name':'title'),c.name),r(f('Статус','status',c.status,'select',M.clinicalStatuses[c.category].map(s=>[s,s==='active'&&kind==='medication'?'Принимаю':statuses[s]])),f('Источник сведений','basis',c.basis,'select',[['self_reported','Моё описание'],['clinician','Со слов врача или из заключения']])));
  const dates=(caption,name,d)=>r(f(caption,name,d.value),f('Точность даты',name+'Precision',d.precision,'select',[['unknown','Неизвестна'],['year','Год'],['month','Месяц'],['day','День']]));
  parts.push(dates('Начало / дата введения','start',c.start));const end=h('div',{'data-clinical-kind':'allergy medication condition surgery other'},dates('Окончание','end',c.end));parts.push(end);
  const group=(categories,children)=>h('div',{'data-clinical-kind':categories,class:'health-clinical-fields'},children);
  parts.push(group('allergy',[f('Реакция и проявления','reaction',c.allergy.reaction,'textarea'),f('Тяжесть реакции по вашим сведениям','severity',c.allergy.severity,'select',Object.entries(severity))]),
   group('medication',[f('Вид препарата','medicationCategory',c.medication.category,'select',[['medication','Лекарство'],['supplement','Добавка']]),r(f('Доза за приём','dose',c.medication.dose),f('Режим приёма','frequency',c.medication.schedule)),r(f('Способ приёма','route',c.medication.route),f('Для чего принимаете','indication',c.medication.indication))]),
   group('vaccine',[r(f('От чего','against',c.vaccination.against),f('Номер / обозначение дозы','doseLabel',c.vaccination.dose_label)),r(f('Серия','lot',c.vaccination.lot),f('Место введения','place',c.vaccination.place))]),
   group('condition surgery other',[f('Описание','description',c.condition.description,'textarea')]),f('Примечание','notes',c.notes,'textarea'));
  const documents=[['','Не связан'],...doc.documents.map(x=>[x.id,x.title||x.name])],episodeChoices=[['','Не связан'],...episodes(doc).map(x=>[x.id,x.title||x.id])];
  if(c.documentId&&!documents.some(x=>x[0]===c.documentId))documents.push([c.documentId,'Сохранённая связь с недоступным документом']);if(c.episodeId&&!episodeChoices.some(x=>x[0]===c.episodeId))episodeChoices.push([c.episodeId,'Сохранённая связь с недоступным эпизодом']);
  parts.push(h('details',{class:'medical-relations'},h('summary',{},'Связанные документ и эпизод болезни'),f('Документ','documentId',c.documentId,'select',documents),f('Эпизод','episodeId',c.episodeId,'select',episodeChoices)));
  return parts;
 }
 function updateForm(form){const category=form.dataset.kind==='medication'?'medication':form.elements.namedItem('category').value,select=form.elements.namedItem('status'),current=select.value;select.replaceChildren(...M.clinicalStatuses[category].map(value=>h('option',{value,selected:value===current},value==='active'&&category==='medication'?'Принимаю':statuses[value])));if(!M.clinicalStatuses[category].includes(current))select.value=M.clinicalStatuses[category][0];for(const box of form.querySelectorAll('[data-clinical-kind]')){box.hidden=!box.dataset.clinicalKind.split(' ').includes(category);for(const input of box.querySelectorAll('input,select,textarea'))input.disabled=box.hidden;}}
 function detail(state,item,kind){
  const c=M.clinical(item,kind),facts=h('dl',{class:'medical-facts'}),append=(name,value)=>facts.append(h('dt',{},name),h('dd',{},value||'Не указано'));
  append('Статус',statusName(c));append('Источник сведений',c.basis==='clinician'?'Со слов врача или из заключения':'Моё описание');append('Период',period(c));
  if(c.category==='allergy'){append('Реакция',c.allergy.reaction);append('Тяжесть по вашим сведениям',severity[c.allergy.severity]);}
  if(c.category==='medication'){for(const [name,key] of [['Доза','dose'],['Режим','schedule'],['Способ приёма','route'],['Для чего','indication']])append(name,c.medication[key]);append('Вид',c.medication.category==='supplement'?'Добавка':'Лекарство');}
  if(c.category==='vaccine')for(const [name,key] of [['От чего','against'],['Доза','dose_label'],['Серия','lot'],['Место','place']])append(name,c.vaccination[key]);
  if(['condition','surgery','other'].includes(c.category))append('Описание',c.condition.description);
  append('Примечание',c.notes);
  const box=V.card(c.name,[facts,h('div',{class:'health-actions'},V.button('Редактировать','edit',{'data-kind':kind,'data-id':item.id}),V.button('Закрыть запись','close-medical'))]);box.classList.add('medical-detail');box.setAttribute('tabindex','-1');
  if(kind==='medication')box.append(h('div',{class:'health-actions'},V.button('Записать приём','care-medication',{'data-id':item.id,'data-view':'intakes'}),V.button('Создать напоминание','care-medication',{'data-id':item.id,'data-view':'reminders'})));
  if(c.documentId){const doc=state.doc.documents.find(x=>x.id===c.documentId);box.append(doc?V.button('Документ: '+(doc.title||doc.name),'file-preview',{'data-id':doc.id}):h('p',{class:'health-note'},'Исходный документ недоступен; связь сохранена.'));}
  if(c.episodeId){const episode=episodes(state.doc).find(x=>x.id===c.episodeId);box.append(episode?V.button('Эпизод: '+episode.title,'open-episode',{'data-id':episode.id}):h('p',{class:'health-note'},'Связанный эпизод недоступен; ссылка сохранена.'));}
  const revisions=state.doc.revisions.filter(x=>x.recordId===item.id);
  box.append(h('details',{},h('summary',{},'История исправлений · '+revisions.length),revisions.map(x=>{const old=x.previous||{},prior=M.clinical(old,kind);return h('div',{class:'medical-revision'},h('small',{},'Исправлено: '+V.date(x.changedAt)),h('p',{},prior.name+' · '+statusName(prior)),h('p',{class:'health-note'},period(prior)),h('p',{class:'preserve'},[summary(prior),prior.notes].filter(Boolean).join('\n')));})));return box;
 }
 function page(state){
  const filter=state.filters.medical||'',query=(state.medicalSearch||'').toLocaleLowerCase('ru-RU'),status=state.medicalStatus||'';
  const all=[...state.doc.medical.map(item=>({item,kind:'medical'})),...state.doc.medications.map(item=>({item,kind:'medication'}))].map(x=>({...x,c:M.clinical(x.item,x.kind)}));
  const rows=all.filter(x=>(!filter||x.c.category===filter)&&(!status||x.c.status===status)&&(!query||[x.c.name,summary(x.c),x.c.notes,x.c.vaccination.lot].join(' ').toLocaleLowerCase('ru-RU').includes(query)));
  const output=h('div',{},V.title('Медкарта','Ваши записи, периоды и источники.',[V.button(filter==='medication'?'Новый препарат':'Новая запись',filter==='medication'?'new-medication':'new-medical',{class:'primary'})]));
  const workspace=h('div',{class:'medical-page'});output.append(workspace);
  workspace.append(h('div',{class:'medical-tabs',role:'group','aria-label':'Разделы медкарты'},[['','Все записи'],...Object.entries(labels)].map(([value,label])=>h('button',{type:'button',class:'button','data-action':'filter-records','data-kind':'medical','data-value':value,'aria-pressed':String(filter===value)},label))));
  const selected=all.find(x=>x.item.id===state.medicalId&&x.kind===state.medicalKind);if(selected)workspace.append(detail(state,selected.item,selected.kind));
  const card=V.card(null);card.classList.add('medical-list');workspace.append(card);
  const search=V.field('Поиск по медкарте','medicalSearch',state.medicalSearch||'');search.querySelector('input').dataset.search='medical';
  const choose=V.field('Статус записи','medicalStatus',status,'select',[['','Все статусы'],...Object.entries(statuses)]);choose.querySelector('select').dataset.medicalStatus='yes';
  card.append(h('div',{class:'medical-filters'},search,choose,h('small',{},'Найдено: '+rows.length)));
  if(!rows.length){card.append(V.empty('Записей по этим условиям нет.'));return output;}
  const table=V.table(['Запись','Раздел','Статус','Период','Сведения','Действия'],rows.map(({item,kind,c})=>[h('button',{class:'medical-name','data-action':'open-medical','data-id':item.id,'data-kind':kind},c.name),labels[c.category],h('span',{class:'medical-status status-'+c.status},statusName(c)),period(c),h('div',{class:'medical-summary'},summary(c),c.notes?h('small',{class:'table-subline'},c.notes):null),V.buttons(kind,item)]));table.classList.add('medical-table-wrap');card.append(table);return output;
 }
 window.HumanMedicalView={page,fields,updateForm,episodes};
})();
