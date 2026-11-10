/* User-reported intakes and calendar reminders are separate facts. */
(() => {
 'use strict';
 const M=window.HumanModel,H=window.HumanHealth;
 const collection=kind=>kind==='intake'?'intakes':'reminders';
 function records(doc,kind){
  const deleted=new Set(doc.careDeletions||[]),out=new Map((doc[collection(kind)]||[]).filter(x=>!deleted.has(x.id)).map(x=>[x.id,x]));
  for(const row of doc.humanMigration?.tables.care_records||[]){if(row.kind!==kind||Number(row.deleted)||deleted.has(row.id)||out.has(row.id))continue;const raw=JSON.parse(row.payload);out.set(row.id,{...raw,id:row.id,version:Number(row.version),human:raw});}
  return Array.from(out.values()).sort((a,b)=>kind==='intake'?Date.parse(b.occurred_at)-Date.parse(a.occurred_at):((Date.parse(a.next_due_at)||Infinity)-(Date.parse(b.next_due_at)||Infinity))||a.title.localeCompare(b.title,'ru'));
 }
 function text(value,max=4000){const s=String(value??'').trim();if(Array.from(s).length>max)throw Error('Текст превышает допустимую длину: '+max+' символов.');return s;}
 function day(value){const d=M.isoDate(value);if(d<'1900-01-01'||d>'2200-12-31')throw Error('Проверьте календарную дату.');return d;}
 function medicine(doc,id,old={},optional=false){
  if(!id){if(!optional)throw Error('Выберите препарат.');return '';}
  if(id===old.medication_id)return old.medication_name||'';
  const row=doc.medications.find(x=>x.id===id);if(!row)throw Error('Препарат не найден. Выберите существующий препарат из медкарты.');return M.clinical(row,'medication').name;
 }
 function meta(old,now){return {...old,id:old.id||M.id(),version:(Number(old.version)||0)+1,source:old.source||{type:'manual'},created_at:old.created_at||new Date(now).toISOString(),updated_at:new Date(now).toISOString()};}
 function checkIntake(input,old={},doc,now=new Date()){
  const occurred_at=text(input.occurred_at),outcome=text(input.outcome),medication_id=text(input.medication_id),dose=text(input.dose),notes=text(input.notes);
  M.observationDate(occurred_at,'exact');if(new Date(occurred_at).getUTCFullYear()<1900||new Date(occurred_at).getUTCFullYear()>2200)throw Error('Проверьте время события.');
  if(Date.parse(occurred_at)>+new Date(now))throw Error('Фактическое событие не может быть в будущем. Проверьте время и часовой пояс.');
  if(!['taken','skipped'].includes(outcome))throw Error('Выберите приём или пропуск.');if(outcome==='skipped'&&dose)throw Error('Для пропуска фактическая доза остаётся пустой.');
  return {...meta(old,now),occurred_at,outcome,medication_id,medication_name:medicine(doc,medication_id,old),dose,notes};
 }
 function localMatches(date,time,zone){
  const target=date+'T'+time,wall=Date.parse(target+'Z'),found=new Set();
  for(let h=-36;h<=36;h+=6){const sample=wall+h*3600000,offset=Date.parse(H.localInput(sample,zone)+'Z')-sample,at=wall-offset;if(H.localInput(at,zone)===target)found.add(at);}
  return Array.from(found).sort((a,b)=>a-b);
 }
 function nextOccurrence(r,after=new Date(),initial=false){
  if(r.frequency==='once'){
   if(!initial)return '';
   const matches=localMatches(r.date,r.time,r.timezone);if(!matches.length)throw Error('Такого местного времени не существует; выберите другое.');
   if(r.utc_offset){const chosen=Date.parse(r.date+'T'+r.time+r.utc_offset);if(!matches.includes(chosen))throw Error('Смещение UTC не соответствует этому времени.');return new Date(chosen).toISOString();}
   if(matches.length>1)throw Error('Местное время повторяется; укажите смещение UTC.');return new Date(matches[0]).toISOString();
  }
  let cursor=[r.date,H.localInput(after,r.timezone).slice(0,10)].sort().at(-1);
  for(let i=0;i<370;i++,cursor=H.shiftDay(cursor,1)){if(r.until_date&&cursor>r.until_date)return '';const matches=localMatches(cursor,r.time,r.timezone);if(matches.length&&matches[0]>+new Date(after))return new Date(matches[0]).toISOString();}
  throw Error('Не удалось определить следующую дату расписания.');
 }
 function checkReminder(input,old={},doc,now=new Date()){
  const title=text(input.title,200),notes=text(input.notes),frequency=text(input.frequency),date=day(input.date),time=text(input.time),timezone=text(input.timezone),until_date=text(input.until_date),utc_offset=text(input.utc_offset),medication_id=text(input.medication_id),enabled=input.enabled===true||input.enabled==='on';
  if(!title)throw Error('Введите название напоминания.');if(!['once','daily'].includes(frequency))throw Error('Выберите разовое или ежедневное напоминание.');
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('Проверьте время напоминания.');try{new Intl.DateTimeFormat('en',{timeZone:timezone}).format();if(!timezone)throw Error();}catch{throw Error('Проверьте часовой пояс.');}
  if(until_date&&(frequency!=='daily'||day(until_date)<date))throw Error('Проверьте окончание ежедневного расписания.');
  if(utc_offset&&(frequency!=='once'||!/^[-+](0\d|1[0-4]):[0-5]\d$/.test(utc_offset)))throw Error('Проверьте смещение UTC разового напоминания.');
  const r={...meta(old,now),title,notes,frequency,date,time,timezone,until_date,utc_offset,medication_id,medication_name:medicine(doc,medication_id,old,true),enabled};
  r.scheduled_at=r.next_due_at=nextOccurrence(r,now,true);if(!r.next_due_at&&enabled)throw Error('В этом расписании нет будущих напоминаний.');return r;
 }
 function due(r,now=new Date()){return r.enabled&&!!r.next_due_at&&Date.parse(r.next_due_at)<=+new Date(now);}
 function act(r,action,{minutes=0,now=new Date()}={}){
  if(!due(r,now))throw Error('Напоминание ещё не наступило или выключено.');const next=meta(r,now);
  if(action==='snooze'){if(![15,60,180].includes(Number(minutes)))throw Error('Выберите отсрочку на 15, 60 или 180 минут.');next.next_due_at=new Date(+new Date(now)+Number(minutes)*60000).toISOString();}
  else if(['done','skipped'].includes(action)){if(Number(minutes))throw Error('Отсрочка задаётся только для откладывания.');next.scheduled_at=next.next_due_at=nextOccurrence(r,now,false);if(!next.next_due_at)next.enabled=false;}
  else throw Error('Выберите действие с напоминанием.');return next;
 }
 window.HumanCare={collection,records,checkIntake,checkReminder,localMatches,nextOccurrence,due,act};
})();
