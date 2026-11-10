/* HUMAN nutrition/activity facts. Missing numbers remain unknown, never zero. */
(() => {
 'use strict';
 const M=window.HumanModel,H=window.HumanHealth;
 const nutrients=['calories_kcal','protein_g','fat_g','carbs_g','alcohol_g'];
 const activityValues=['steps','sleep_minutes','exercise_minutes'];
 const day=value=>{const d=M.isoDate(value);if(d<'1900-01-01'||d>'2200-12-31')throw Error('Дата должна быть между 1900 и 2200 годом.');return d;};
 const text=(value,max)=>{const s=String(value??'').trim();if(Array.from(s).length>max)throw Error('Слишком длинный текст: максимум '+max+' символов.');return s;};
 function numeric(value,max,integer=false){if(value==null||String(value).trim()==='')return null;const n=M.number(String(value));if(n===null||n<0||n>max||integer&&!Number.isInteger(n))throw Error('Проверьте число: от 0 до '+max+(integer?', целое значение.':'.'));return n;}
 function isDaily(row){return row.kind==='activity';}
 function normalize(row,doc){return row.kind==='food'?{...row,date:H.localInput(row.eaten_at,doc.profile?.timezone).slice(0,10)}:{...row};}
 function records(doc,kind){return doc.diary.filter(row=>kind==='meal'?row.kind==='food':row.kind==='activity').map(row=>normalize(row,doc)).sort((a,b)=>kind==='meal'?Date.parse(b.eaten_at)-Date.parse(a.eaten_at)||a.id.localeCompare(b.id):b.date.localeCompare(a.date)||a.id.localeCompare(b.id));}
 function meta(original,kind,now){return {...original,id:original.id||(kind==='meal'?'meal:'+M.id():''),kind:kind==='meal'?'food':'activity',origin:original.origin||{type:'manual'},version:(original.version||0)+1,createdAt:original.createdAt||new Date(now).toISOString(),updatedAt:new Date(now).toISOString()};}
 function checkMeal(input,original={},doc,now=new Date()){
  original=original||{};const zone=H.zoneName(doc.profile?.timezone),description=text(input.description,1000),notes=text(input.notes,4000);if(!description)throw Error('Укажите, что съели.');
  let eaten_at=input.eaten_at??original.eaten_at??'';
  if(Object.hasOwn(input,'at'))eaten_at=input.at?(original.eaten_at&&H.localInput(original.eaten_at,zone)===input.at&&!input.offset?original.eaten_at:H.timestamp(input.at,zone,input.offset||'')):'';
  if(!eaten_at)throw Error('Укажите дату и время приёма пищи.');M.observationDate(eaten_at,'exact');const date=day(H.localInput(eaten_at,zone).slice(0,10));
  const out={...meta(original,'meal',now),description,title:description,eaten_at,date,notes,estimated:input.estimated===true||input.estimated==='on'};
  for(const key of nutrients)out[key]=numeric(input[key],key==='calories_kcal'?100000:10000);return out;
 }
 function deletedActivity(doc,date){
  const previous=(doc.revisions||[]).slice().reverse().find(r=>r.operation==='delete'&&r.previous?.kind==='activity'&&r.previous.date===date&&isDaily(r.previous));
  if(previous)return normalize(previous.previous,doc);
  return null;
 }
 function checkActivity(input,original={},doc,now=new Date()){
  original=original||{};const date=day(input.date),activity_type=text(input.activity_type,200),notes=text(input.notes,4000);
  if(original.id&&original.date!==date)throw Error('Дата дневной записи не меняется. Выберите другой день в дневнике.');
  if(records(doc,'activity-day').some(r=>r.date===date&&r.id!==original.id))throw Error('За этот день уже есть запись. Откройте её для изменения.');
  const prior=original.id?original:deletedActivity(doc,date)||original,out={...meta(prior,'activity-day',now),id:prior.id||'activity:'+date,date,daily:true,activity_type,title:activity_type||'Активность за '+date,notes};
  for(const key of activityValues)out[key]=numeric(input[key],key==='steps'?200000:1440,true);
  if(activityValues.every(k=>out[k]===null)&&!activity_type&&!notes)throw Error('Укажите известные показатели или заметку о дне.');return out;
 }
 function summary(doc,date){const rows=records(doc,'meal').filter(r=>r.date===date),result={count:rows.length,estimated:rows.filter(r=>r.estimated).length};for(const key of nutrients){const values=rows.map(r=>r[key]).filter(x=>x!==null&&x!==undefined);result[key]={known:values.length,value:values.length?values.reduce((a,b)=>a+b,0):null};}return result;}
 const formatNumber=value=>value==null?'—':value.toLocaleString('ru-RU',{maximumFractionDigits:1});
 const duration=value=>value==null?'—':Math.floor(value/60)+' ч '+value%60+' мин';
 window.HumanDiary={nutrients,activityValues,day,isDaily,normalize,records,checkMeal,checkActivity,deletedActivity,summary,formatNumber,duration};
})();
