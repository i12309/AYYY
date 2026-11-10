/* Compact HUMAN diary pages over the encrypted browser journal. */
(() => {
 'use strict';
 const V=window.HumanView,D=window.HumanDiary,H=window.HumanHealth,h=V.h,n=D.formatNumber;
 const mealLabels={calories_kcal:'Калории, ккал',protein_g:'Белки, г',fat_g:'Жиры, г',carbs_g:'Углеводы, г',alcohol_g:'Этанол, г'};
 const activityLabels={steps:'Шаги',sleep_minutes:'Сон, минут',exercise_minutes:'Упражнения, минут'};
 const origin=()=> 'Ручной ввод';
 const zone=state=>H.zoneName(state.doc.profile.timezone);
 const today=state=>H.localInput(new Date(),zone(state)).slice(0,10);
 const selectedDay=state=>state.diaryDays?.[state.tab]||(state.demo?D.records(state.doc,state.tab==='nutrition'?'meal':'activity-day')[0]?.date:'')||today(state);
 function history(doc,kind,item){
  const revisions=doc.revisions.filter(r=>r.recordId===item.id);
  const box=h('details',{class:'diary-history'},h('summary',{},'История изменений · '+revisions.length));if(!revisions.length)box.append(h('p',{class:'health-muted'},'Исправлений пока нет.'));
  for(const r of revisions.slice().reverse()){
   const raw=r.previous||{},prior=D.normalize(raw,doc),facts=h('dl',{class:'metadata'});
   const pairs=kind==='meal'?[['Блюдо',prior.description],['Дата',prior.eaten_at?new Date(prior.eaten_at).toLocaleString('ru-RU',{timeZone:zone({doc})}):V.date(prior.date)],...D.nutrients.map(k=>[mealLabels[k],n(prior[k])]),['Приблизительно',prior.estimated?'Да':'Нет']]:[['Дата',V.date(prior.date)],...D.activityValues.map(k=>[activityLabels[k],n(prior[k])]),['Вид упражнений',prior.activity_type]];
   for(const [label,value] of [...pairs,['Заметки',prior.notes||'—']])facts.append(h('div',{},h('dt',{},label),h('dd',{},value??'—')));
   box.append(h('details',{},h('summary',{},'Версия '+(prior.version||'—')+' · '+V.date(r.changedAt)),facts));
  }
  return box;
 }
 function editor(state,kind,item){
  const f=V.field,day=selectedDay(state),tz=zone(state),fields=[];
  if(kind==='meal'){
   const initial=item?H.localInput(item.eaten_at,tz):day+H.localInput(new Date(),tz).slice(10);
   fields.push(h('div',{class:'diary-form-grid'},f('Что съели','description',item?.description||'','text',null,true),f('Дата и время · '+tz,'at',initial,'datetime-local',null,true)));

   fields.push(h('p',{class:'health-muted'},'Укажите значения для всей порции. Неизвестные поля оставьте пустыми.'),h('div',{class:'diary-nutrients'},Object.entries(mealLabels).map(([key,label])=>f(label,key,item?.[key]??''))),h('label',{class:'diary-check'},h('input',{name:'estimated',type:'checkbox',checked:item?.estimated||false}),'Это моя приблизительная оценка'),h('details',{},h('summary',{},'Заметка и дополнительные поля'),f('Заметка','notes',item?.notes||'','textarea'),f('Смещение UTC для неоднозначного времени','offset','')));
  }else fields.push(h('input',{type:'hidden',name:'date',value:item?.date||day}),h('div',{class:'diary-nutrients activity-fields'},Object.entries(activityLabels).map(([key,label])=>f(label,key,item?.[key]??''))),h('p',{class:'health-muted'},'Одна запись за день. Неизвестные значения оставьте пустыми. 7 ч 30 мин сна = 450 минут.'),h('div',{class:'diary-form-grid'},f('Вид упражнений','activity_type',item?.activity_type||''),f('Заметки о дне','notes',item?.notes||'','textarea')));
  const form=V.form('record',[...fields,h('p',{class:'error',role:'alert',hidden:true,'data-form-error':'yes'})],kind==='meal'?'Сохранить еду':'Сохранить день');form.dataset.kind=kind;if(item)form.dataset.id=item.id;
  form.querySelector('.health-form-actions').append(V.button('Отмена','close-diary-editor'));
  for(const key of kind==='meal'?D.nutrients:D.activityValues){const input=form.querySelector('[name='+key+']');input.setAttribute('inputmode',kind==='meal'?'decimal':'numeric');input.setAttribute('autocomplete','off');}
  const card=V.card((item?'Изменить ':'Новый ')+(kind==='meal'?'приём пищи':'день · '+V.date(day)),[form]);card.classList.add('diary-editor');card.dataset.editorKey=kind+':'+(item?.id||day);if(item)card.append(history(state.doc,kind,item));return card;
 }
 function metric(title,value,unit,hint,tone,icon){return h('div',{class:'metric tone-'+tone},h('span',{class:'metric-icon'},V.icon(icon,19)),h('div',{class:'metric-copy'},h('span',{class:'metric-label'},title),h('div',{class:'metric-countline'},h('strong',{class:'metric-number'},value),unit?h('small',{},unit):null),h('span',{class:'metric-hint'},hint)));}
 function chart(items,metricName){
  const labels={steps:'Шаги',sleep_minutes:'Сон, мин',exercise_minutes:'Упражнения, мин'},points=items.slice(0,30).filter(r=>r[metricName]!=null).slice().reverse(),box=V.card(null);box.classList.add('diary-chart');
  box.append(h('div',{class:'diary-toolbar'},h('h2',{},'Ритм дней'),h('div',{class:'actions'},Object.entries(labels).map(([key,label])=>V.button(label,'diary-metric',{'data-metric':key,'aria-pressed':String(metricName===key)})))));
  if(!points.length){box.append(V.empty('Для этого показателя ещё нет значений.'));return box;}
  const width=window.innerWidth<=700?Math.max(280,window.innerWidth-56):Math.max(280,Math.min(900,(window.innerWidth||1200)-280)),max=Math.max(1,...points.map(p=>p[metricName])),first=Date.parse(points[0].date+'T00:00:00Z'),span=Math.max(86400000,Date.parse(points.at(-1).date+'T00:00:00Z')-first),ns='http://www.w3.org/2000/svg';
  const s=(tag,attrs={},text)=>{const el=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));if(text!==undefined)el.textContent=text;return el;},svg=s('svg',{viewBox:'0 0 '+width+' 180',role:'img','aria-label':labels[metricName]+': '+points.length+' записей'});
  for(const ratio of [0,.5,1]){svg.append(s('line',{x1:45,x2:width-20,y1:140-ratio*110,y2:140-ratio*110,stroke:'#e1e6ef','stroke-dasharray':'3 5'}),s('text',{x:38,y:144-ratio*110,'text-anchor':'end',fill:'#6c7b91','font-size':10},n(max*ratio)));}
  for(const point of points){const x=points.length===1?width/2:60+(Date.parse(point.date+'T00:00:00Z')-first)/span*(width-90),y=140-point[metricName]/max*110,bar=Math.min(16,Math.max(4,(width-90)/points.length*.65)),g=s('g',{role:'button',tabindex:0,'data-action':'diary-choose-day','data-day':point.date,'aria-label':V.date(point.date)+': '+n(point[metricName])});g.append(s('title',{},V.date(point.date)+' · '+n(point[metricName])),s('rect',{x:x-bar/2,y,width:bar,height:Math.max(2,140-y),rx:3,fill:'#329e80'}),s('circle',{cx:x,cy:y,r:4,fill:'#18795e'}));svg.append(g);}
  svg.append(s('text',{x:50,y:165,'font-size':11,fill:'#6c7b91'},V.date(points[0].date)),s('text',{x:width-25,y:165,'font-size':11,fill:'#6c7b91','text-anchor':'end'},points.length>1?V.date(points.at(-1).date):''));box.append(svg,h('p',{class:'health-muted'},'До 30 записей текущего списка. Пустые значения пропущены. Нажмите столбец, чтобы открыть день.'));return box;
 }
 function page(state){
  const meal=state.tab==='nutrition',kind=meal?'meal':'activity-day',day=selectedDay(state),tz=zone(state),all=D.records(state.doc,kind),current=all.find(r=>r.date===day),query=(state.diaryQueries?.[state.tab]||'').toLocaleLowerCase('ru-RU'),root=h('div',{},V.title(meal?'Питание':'Активность',meal?'Приёмы пищи и известные значения для всей порции.':'Шаги, сон и упражнения по дням.')),page=h('div',{class:'diary-page'});root.append(page);
  const picker=h('input',{type:'date','aria-label':'Дата дневника',min:'1900-01-01',max:'2200-12-31',value:day,'data-diary-day':'yes'});
  page.append(h('div',{class:'diary-toolbar'},h('div',{class:'actions'},V.button('‹','diary-shift',{'data-delta':-1,'aria-label':'Предыдущий день'}),picker,V.button('›','diary-shift',{'data-delta':1,'aria-label':'Следующий день'}),V.button('Сегодня','diary-today')),h('div',{class:'actions'},V.button(meal?'Записать еду':current?'Изменить день':'Записать день','new-'+kind,{class:'primary'}))));
  let activeEditor=null;if(state.diaryEditor?.kind===kind){const editing=state.diaryEditor.id?all.find(r=>r.id===state.diaryEditor.id):null;if(!state.diaryEditor.id||editing)activeEditor=editor(state,kind,editing);if(meal&&activeEditor)page.append(activeEditor);}
  if(meal){const summary=D.summary(state.doc,day);page.append(h('div',{class:'metrics diary-metrics'},[['calories_kcal','Калории','ккал','yellow','Flame'],['protein_g','Белки','г','blue','Beef'],['fat_g','Жиры','г','green','Droplets'],['carbs_g','Углеводы','г','red','Wheat']].map(([key,label,unit,tone,icon])=>metric(label,n(summary[key].value),unit,summary[key].known+' из '+summary.count+' записей',tone,icon))),h('div',{class:'diary-caption'},h('span',{},V.date(day)+' · '+tz),h('span',{},'Этанол: '+n(summary.alcohol_g.value)+' г · заполнено '+summary.alcohol_g.known+' из '+summary.count),summary.estimated?h('span',{},'Приблизительных оценок: '+summary.estimated):null));}
  else {page.append(h('div',{class:'metrics diary-metrics activity-metrics'},metric('Шаги',n(current?.steps),'',V.date(day),'green','Footprints'),metric('Сон',D.duration(current?.sleep_minutes),'',V.date(day),'blue','Moon'),metric('Упражнения',n(current?.exercise_minutes),'мин',current?.activity_type||V.date(day),'yellow','Dumbbell')),activeEditor|| (current?h('div',{class:'diary-caption'},h('span',{},current.activity_type||'Вид упражнений не указан'),h('span',{class:'preserve'},current.notes),h('span',{},origin(current))):h('p',{class:'health-muted'},'За '+V.date(day)+' записей нет. Можно внести только известные показатели.')));}
  const rows=all.filter(r=>(!meal||state.diaryAll||r.date===day)&&(!query||[r.description,r.activity_type,r.notes,r.date].join(' ').toLocaleLowerCase('ru-RU').includes(query))),offset=Math.max(0,Math.min(state.diaryOffsets?.[state.tab]||0,Math.floor(Math.max(0,rows.length-1)/50)*50)),shown=rows.slice(offset,offset+50);
  if(!meal)page.append(chart(shown,state.diaryMetric||'steps'));
  const list=V.card(null);list.classList.add('diary-list');const search=h('input',{type:'search','aria-label':meal?'Поиск еды':'Поиск активности',placeholder:meal?'Найти блюдо':'Вид упражнений или дата',value:state.diaryQueries?.[state.tab]||'','data-search':'diary-native'});
  list.append(h('div',{class:'diary-toolbar'},h('h2',{},meal?'Приёмы пищи':'История по дням',h('small',{},' '+rows.length)),h('div',{class:'actions'},meal?[V.button('За день','diary-range',{'data-all':'false','aria-pressed':String(!state.diaryAll)}),V.button('Вся история','diary-range',{'data-all':'true','aria-pressed':String(!!state.diaryAll)})]:null,search)));
  if(!shown.length)list.append(V.empty(query?'По этому запросу записей нет.':meal?'Записей пока нет. Добавьте блюдо; калории и БЖУ можно заполнить позже.':'Добавьте шаги, сон или упражнения за первый день.'));
  else {
   const labels=meal?['Время и блюдо','ккал','Б / Ж / У, г','Этанол, г','Источник','Действия']:['Дата','Шаги','Сон','Упражнения','Источник','Действия'];
   const rows=shown.map(r=>{const actions=h('div',{class:'actions'},V.h('button',{type:'button',class:'button','data-action':'edit','data-kind':kind,'data-id':r.id,'aria-label':'Изменить '+(meal?r.description:V.date(r.date))},V.icon('PencilLine',14)),V.h('button',{type:'button',class:'button','data-action':'remove','data-kind':kind,'data-id':r.id,'aria-label':'Удалить '+(meal?r.description:V.date(r.date))},V.icon('Trash2',14))),notes=r.notes?h('details',{},h('summary',{},'Заметка'),h('p',{class:'preserve'},r.notes)):null;
    return meal?[h('div',{},h('strong',{},r.description),h('small',{},new Date(r.eaten_at).toLocaleString('ru-RU',{timeZone:tz,dateStyle:'short',timeStyle:'short'}),r.estimated?' · оценка':''),notes),h('strong',{},n(r.calories_kcal)),[n(r.protein_g),n(r.fat_g),n(r.carbs_g)].join(' / '),n(r.alcohol_g),origin(r),actions]:[h('button',{type:'button',class:'document-link','data-action':'diary-choose-day','data-day':r.date},V.date(r.date)),n(r.steps),D.duration(r.sleep_minutes),h('div',{},h('strong',{},n(r.exercise_minutes)+' мин'),h('small',{},r.activity_type),notes),origin(r),actions];
   });
   const table=V.table(labels,rows);table.className='diary-table-wrap';table.querySelector('table').className='diary-table';Array.from(table.querySelectorAll('tbody tr')).forEach((tr,i)=>{if(!meal&&shown[i].date===day)tr.classList.add('selected');Array.from(tr.children).forEach((td,j)=>{if(j>0&&j<labels.length-1)td.setAttribute('data-label',labels[j]);});});list.append(table);
  }
  if(rows.length>50)list.append(h('div',{class:'diary-pager'},V.button('Назад','diary-page',{'data-offset':Math.max(0,offset-50),disabled:!offset}),h('span',{},offset+1+'–'+Math.min(offset+50,rows.length)+' из '+rows.length),V.button('Далее','diary-page',{'data-offset':offset+50,disabled:offset+50>=rows.length})));
  page.append(list);
  return root;
 }
 window.HumanDiaryView={page,selectedDay};
})();
