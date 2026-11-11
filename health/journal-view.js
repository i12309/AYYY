/* HUMAN profile cards and action timeline using the current browser model. */
(() => {
 'use strict';
 const V=window.HumanView,J=window.HumanJournal,h=V.h;
 const sexes={unknown:'Не указан',female:'Женский',male:'Мужской',intersex:'Интерсекс'};
 function profileFields(profile){return [V.field('Имя или псевдоним','name',profile.name||'','text',null,true),V.row(V.field('Дата рождения','birthDate',profile.birthDate||'','date'),V.field('Пол при рождении','sex',profile.sex||'unknown','select',Object.entries(sexes))),h('p',{class:'health-note','data-profile-age':'yes'}),h('div',{'data-profile-height':'yes'},V.field('Рост, см','heightCm',profile.heightCm??'')),V.field('Часовой пояс','timezone',profile.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC','text',null,true),V.field('Дополнительно','notes',profile.notes||'','textarea')];}
 function updateProfileForm(form){const zone=form.elements.timezone.value,birth=form.elements.birthDate.value,day=J.profileDay({timezone:zone}),age=J.ageOn(birth,day),box=form.querySelector('[data-profile-height]');form.elements.birthDate.max=day;box.hidden=age==null||age<20;form.elements.heightCm.disabled=box.hidden;form.elements.heightCm.setAttribute('inputmode','decimal');form.querySelector('[data-profile-age]').textContent=age==null?'':age<20?'Возраст: '+age+' лет. Рост записывается по датам в разделе «Показатели».':'Возраст: '+age+' лет. Основной рост можно исправить здесь.';}
 function profilePage(state,panels=[]){
  const p=state.doc.profile,age=J.ageOn(p.birthDate,J.profileDay(p));
  const root=h('div',{class:'profile-page'},V.title('Мой профиль','Личные данные, безопасность и синхронизация.'));
  const left=h('div',{class:'health-profile-stack'}),right=h('div',{class:'health-profile-stack'});
  const personal=V.card(null);
  personal.classList.add('settings','health-profile-personal');
  personal.append(h('div',{class:'section-heading tone-blue'},
    h('h2',{},h('span',{class:'section-mark'}),'Личные данные'),V.icon('UserRound',19)));
  const facts=h('dl',{class:'metadata'});
  const add=(label,value)=>facts.append(h('dt',{},label),h('dd',{},value));
  add('Имя',p.name||'Профиль ещё не заполнен');
  add('Дата рождения',p.birthDate?V.date(p.birthDate)+(age!=null?' · '+age+' лет':''):'Не указана');
  add('Рост',age!=null&&age<20?V.button('История роста в «Показателях»','profile-growth',{class:'small'}):p.heightCm!=null?p.heightCm+' см':'Не указан');
  add('Пол при рождении',sexes[p.sex]||'Не указан');
  add('Часовой пояс',p.timezone||'Не указан');
  personal.append(facts);
  if(p.notes)personal.append(h('p',{class:'preserve'},p.notes));
  personal.append(h('div',{class:'health-profile-actions'},
    V.button('Редактировать профиль','edit-profile'),
    V.button(state.demo?'Выйти из демо':'Закрыть журнал',state.demo?'exit-demo':'lock')));
  left.append(personal);
  for(const panel of panels){
    if(panel.classList.contains('profile-panel-github')||panel.classList.contains('profile-panel-conflict'))right.append(panel);
    else left.append(panel);
  }
  root.append(h('div',{class:'health-profile-columns'},left,right));
  return root;
 }
 function visual(e){if(e.recordKind==='lab')return ['FlaskConical','blue'];if(e.recordKind==='genetic')return ['Dna','green'];if(e.recordKind==='document')return ['FileText','red'];if(e.recordKind==='meal')return ['Utensils','green'];if(e.recordKind==='activity-day')return ['Dumbbell','yellow'];if(e.recordKind==='profile')return ['UserRound','blue'];return ['History','yellow'];}
 function timelinePage(state){
  const kind=state.timelineKind||'',query=state.timelineQuery||'',events=J.events(state.doc,{kind,query}),offset=Math.max(0,Math.min(state.timelineOffset||0,Math.floor(Math.max(0,events.length-1)/50)*50)),root=h('div',{class:'timeline-page'},V.title('История','Что и когда появилось в вашем журнале.')),card=V.card(null);root.append(card);
  const select=h('select',{'aria-label':'Тип события','data-timeline-kind':'yes'},h('option',{value:''},'Все события'),Object.entries(J.labels).map(([value,label])=>h('option',{value,selected:value===kind},label))),search=h('input',{type:'search','aria-label':'Поиск по истории',placeholder:'Название записи',value:query,'data-search':'timeline'});card.append(h('div',{class:'filters timeline-filter'},select,search),h('p',{class:'health-note'},'Событий: '+events.length));
  if(!events.length){card.append(V.empty(kind||query?'Событий выбранного типа пока нет.':'История появится после добавления первых данных.'));return root;}
  card.append(h('ol',{class:'timeline'},events.slice(offset,offset+50).map(e=>{const [icon,tone]=visual(e),row=J.findRecord(state.doc,e),button=h('button',{type:'button',class:'timeline-open','data-action':'timeline-open','data-id':e.id},e.title);return h('li',{},h('span',{class:'timeline-icon tone-'+tone},V.icon(icon,16)),h('div',{class:'timeline-copy'},button,h('small',{},J.labels[e.kind]||e.kind,!row&&e.operation==='delete'?' · запись удалена':'')),h('time',{datetime:e.happenedAt},new Date(e.happenedAt).toLocaleString('ru-RU',{timeZone:window.HumanHealth.zoneName(state.doc.profile.timezone),dateStyle:'short',timeStyle:'short'})));})));
  if(events.length>50)card.append(h('div',{class:'diary-pager'},V.button('Назад','timeline-page',{'data-offset':Math.max(0,offset-50),disabled:!offset}),h('span',{},offset+1+'–'+Math.min(offset+50,events.length)+' из '+events.length),V.button('Далее','timeline-page',{'data-offset':offset+50,disabled:offset+50>=events.length})));
  return root;
 }
 window.HumanJournalView={profileFields,updateProfileForm,profilePage,timelinePage};
})();
