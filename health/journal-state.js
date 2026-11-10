/* Current profile and append-only action history. No reconstruction of older formats. */
(() => {
 'use strict';
 const M=window.HumanModel,H=window.HumanHealth;
 const collections={observations:'lab',vitals:'vital',episodes:'episode',medical:'medical',medications:'medication',findings:'genetic',diary:'diary',documents:'document',intakes:'intake',reminders:'reminder'};
 const labels={observation:'Анализ',observation_revision:'Исправление анализа',observation_deleted:'Удаление анализа',health_created:'Домашний показатель',health_updated:'Исправление показателя',health_deleted:'Удаление показателя',medical_created:'Запись медкарты',medical_updated:'Исправление медкарты',medical_deleted:'Удаление записи медкарты',genetic_finding:'Генетика',genetic_updated:'Исправление генетической записи',genetic_deleted:'Удаление генетической записи',meal_created:'Питание',meal_updated:'Изменение питания',meal_deleted:'Удаление питания',activity_created:'Активность',activity_updated:'Изменение активности',activity_deleted:'Удаление активности',diary_created:'Дневник',diary_updated:'Изменение дневника',diary_deleted:'Удаление записи дневника',document:'Документ',document_deleted:'Удалён документ',care_intake:'Приём или пропуск',care_intake_updated:'Исправление приёма',care_intake_deleted:'Удаление приёма',care_reminder:'Напоминание',care_reminder_deleted:'Удаление напоминания',profile:'Профиль',import:'Импорт',security:'Защита журнала',restore:'Восстановление копии'};
 const typeFor=(kind,operation)=>({lab:operation==='create'?'observation':operation==='delete'?'observation_deleted':'observation_revision',vital:'health_',episode:'health_',medical:'medical_',medication:'medical_',genetic:operation==='create'?'genetic_finding':operation==='delete'?'genetic_deleted':'genetic_updated',meal:'meal_','activity-day':'activity_',diary:'diary_',document:operation==='delete'?'document_deleted':'document',intake:operation==='create'?'care_intake':operation==='delete'?'care_intake_deleted':'care_intake_updated',reminder:operation==='delete'?'care_reminder_deleted':'care_reminder',profile:'profile'})[kind];
 function recordKind(kind,row){return kind==='diary'?(row.kind==='food'?'meal':row.kind==='activity'?'activity-day':'diary'):kind;}
 function title(kind,row){if(kind==='profile')return 'Профиль обновлён';return row.title||row.name||row.description||row.medication_name||row.type||row.activity_type||row.date||'Запись';}
 function event(kind,row,operation,at=new Date(),action=''){
  const record=recordKind(kind,row),base=typeFor(record,operation);if(!base)throw Error('Неизвестный вид события.');const type=base.endsWith('_')?base+(operation==='create'?'created':operation==='delete'?'deleted':'updated'):base;
  let prefix=operation==='create'?'Добавлено: ':operation==='delete'?'Удалено: ':'Исправлено: ';
  if(record==='profile')prefix='';if(record==='reminder'&&operation==='edit')prefix=({done:'Выполнено напоминание: ',skipped:'Пропущено напоминание: ',snooze:'Отложено напоминание: ',toggle:'Изменено напоминание: '})[action]||prefix;
  if(record==='episode'&&action.startsWith('episode_'))prefix='Уточнено состояние эпизода: ';
  return {id:M.id(),kind:type,recordKind:record,entityId:row.id||'profile',operation,title:prefix+title(record,row),happenedAt:new Date(at).toISOString()};
 }
 function appendChanges(before,after,at=new Date()){
  const events=[];
  for(const [collection,kind] of Object.entries(collections)){
   const old=new Map(before[collection].map(x=>[x.id,x])),next=new Map(after[collection].map(x=>[x.id,x]));
   for(const [id,row] of next){const previous=old.get(id);if(previous&&JSON.stringify(previous)===JSON.stringify(row))continue;const revision=after.revisions.slice(before.revisions.length).findLast(r=>r.recordId===id);events.push(event(kind,row,previous?'edit':'create',at,revision?.operation||''));}
   for(const [id,row] of old)if(!next.has(id))events.push(event(kind,row,'delete',at));
  }
  if(JSON.stringify(before.profile)!==JSON.stringify(after.profile)||after.revisions.slice(before.revisions.length).some(r=>r.kind==='profile'))events.push(event('profile',after.profile,'edit',at));
  const imported=after.observations.filter(r=>!before.observations.some(x=>x.id===r.id)&&r.provenance);
  if(imported.length)events.push({id:M.id(),kind:'import',recordKind:'document',entityId:imported[0].documentId,operation:'import',title:'Импорт: '+imported.length+' результатов · '+imported[0].provenance.filename,happenedAt:new Date(at).toISOString()});
  after.timeline.push(...events);return events;
 }
 function findRecord(doc,e){if(e.recordKind==='profile')return doc.profile;const collection=Object.keys(collections).find(k=>collections[k]===e.recordKind)||(['meal','activity-day'].includes(e.recordKind)?'diary':'');return doc[collection]?.find(r=>r.id===e.entityId)||null;}
 function events(doc,{kind='',query=''}={}){const q=query.toLocaleLowerCase('ru-RU');return doc.timeline.filter(e=>(!kind||e.kind===kind)&&(!q||e.title.toLocaleLowerCase('ru-RU').includes(q))&&(!['observation','observation_revision'].includes(e.kind)||!!findRecord(doc,e))).slice().sort((a,b)=>Date.parse(b.happenedAt)-Date.parse(a.happenedAt)||b.id.localeCompare(a.id));}
 function ageOn(birth,day){if(!birth)return null;try{M.isoDate(birth);M.isoDate(day);}catch{return null;}if(birth>day)return null;return Number(day.slice(0,4))-Number(birth.slice(0,4))-(day.slice(5)<birth.slice(5)?1:0);}
 const profileDay=(profile,now=new Date())=>H.localInput(now,H.zoneName(profile.timezone)).slice(0,10);
 function checkProfile(input,original={},now=new Date()){
  const name=String(input.name??'').trim(),timezone=String(input.timezone??'').trim(),sex=String(input.sex??'unknown'),birthDate=String(input.birthDate??'').trim(),notes=String(input.notes??'').trim();
  if(!name||Array.from(name).length>200)throw Error('Укажите имя или псевдоним до 200 символов.');try{if(!timezone)throw Error();new Intl.DateTimeFormat('en',{timeZone:timezone}).format();}catch{throw Error('Укажите действующий часовой пояс, например Europe/Moscow.');}
  if(!['unknown','female','male','intersex'].includes(sex))throw Error('Выберите значение поля «Пол при рождении».');if(birthDate&&(M.isoDate(birthDate)<'1850-01-01'||birthDate>profileDay({timezone},now)))throw Error('Проверьте дату рождения: от 1850 года до сегодняшнего дня.');
  const raw=Object.hasOwn(input,'heightCm')?String(input.heightCm??'').trim():original.heightCm==null?'':String(original.heightCm),heightCm=raw?M.number(raw):null;if(raw&&(heightCm===null||heightCm<=0||heightCm>300))throw Error('Рост должен быть положительным числом до 300 см.');if(Array.from(notes).length>3000)throw Error('Примечание превышает 3000 символов.');
  return {...original,name,timezone,sex,birthDate,heightCm,notes};
 }
 window.HumanJournal={collections,labels,recordKind,event,appendChanges,findRecord,events,ageOn,profileDay,checkProfile};
})();
