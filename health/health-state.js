/* Home measurements and reported episodes. No inferred diagnoses or automatic recovery. */
(() => {
 'use strict';
 const M=window.HumanModel;
 const definitions={'Масса':{unit:'кг',icon:'Scale'},'Давление':{unit:'мм рт. ст.',icon:'HeartPulse'},'Пульс':{unit:'уд/мин',icon:'Activity'},'Температура':{unit:'°C',icon:'Thermometer'},'Сатурация':{unit:'%',icon:'HeartPulse'},'Частота дыхания':{unit:'вдох/мин',icon:'Activity'},'Глюкоза':{unit:'ммоль/л',icon:'TestTubeDiagonal'},'Сон':{unit:'ч',icon:'Clock'},'Шаги':{unit:'шагов',icon:'Footprints'},'Рост':{unit:'см',icon:'Ruler'}};
 function zoneName(zone){try{new Intl.DateTimeFormat('en',{timeZone:zone||'UTC'}).format();return zone||'UTC';}catch{return 'UTC';}}
 function localInput(instant,zone){const parts=new Intl.DateTimeFormat('sv-SE',{timeZone:zoneName(zone),year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(instant)),p=key=>parts.find(x=>x.type===key)?.value||'';return `${p('year')}-${p('month')}-${p('day')}T${p('hour')}:${p('minute')}`;}
 function shiftDay(day,delta){const date=new Date(M.isoDate(day)+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+delta);return date.toISOString().slice(0,10);}
 function timestamp(value,zone,explicitOffset=''){
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error('Проверьте дату и время.');M.isoDate(value.slice(0,10));if(Number(value.slice(11,13))>23||Number(value.slice(14,16))>59)throw Error('Проверьте время.');
  if(explicitOffset){if(!/^[+-](0\d|1[0-4]):[0-5]\d$/.test(explicitOffset))throw Error('Смещение UTC: например +03:00');const t=new Date(value+explicitOffset);if(!Number.isFinite(t.getTime()))throw Error('Проверьте дату и время.');return t.toISOString();}
  const wall=Date.parse(value+'Z'),candidates=new Set();for(let h=-36;h<=36;h+=6){const sample=wall+h*3600000,offset=Date.parse(localInput(sample,zone)+'Z')-sample,instant=new Date(wall-offset);if(localInput(instant,zone)===value)candidates.add(instant.toISOString());}
  if(candidates.size!==1)throw Error('Это время пропущено или повторяется при переводе часов. Укажите смещение UTC или выберите другое время.');return Array.from(candidates)[0];
 }
 function reviewTime(now,zone,days){
  if(![1,3,7].includes(Number(days)))throw Error('Выберите повторный вопрос через 1, 3 или 7 дней.');
  const at=localInput(now,zone),wall=Date.parse(shiftDay(at.slice(0,10),Number(days))+at.slice(10)+'Z'),offset=t=>Date.parse(localInput(t,zone)+'Z')-t;
  // Match HUMAN's Go time.Date/AddDate lookup across skipped/repeated local hours.
  // Manual timestamp input still requires explicit disambiguation.
  const initialOffset=offset(wall),resolvedOffset=offset(wall-initialOffset);
  return new Date(wall-resolvedOffset+((new Date(now).getTime()%60000+60000)%60000)).toISOString();
 }
 function checkedText(input,key,old='',max=4000){const value=String(input[key]??old).trim();if(Array.from(value).length>max&&value!==old)throw Error('Поле '+key+' слишком длинное.');return value;}
 function episodes(doc){return doc.episodes.slice().sort((a,b)=>timePoint(b)-timePoint(a));}
 function episodeState(record,now=new Date()) {const status=record.status||(record.endDate?'ended':'unknown'),needsReview=status!=='ended'&&(status==='unknown'||!record.confirmedAt||!Number.isFinite(Date.parse(record.confirmedUntil))||Date.parse(record.confirmedUntil)<=new Date(now).getTime()),promptDue=needsReview&&(!Number.isFinite(Date.parse(record.nextPromptAt))||Date.parse(record.nextPromptAt)<=new Date(now).getTime());return {status,needsReview,promptDue};}
 function label(record,now){const s=episodeState(record,now);return s.needsReview?'Нужно уточнить':s.status==='ended'?'Завершён':'Ещё болею · подтверждено';}
 function checkEpisode(input,original={},now=new Date(),zone='UTC'){
  original=original||{};const title=checkedText(input,'title',original.title),date=M.isoDate(input.date??original.date??localInput(now,zone).slice(0,10)),basis=String(input.diagnosisBasis??original.diagnosisBasis??'self_reported'),status=String(input.status??original.status??(original.endDate?'ended':'unknown'));
  if(!title)throw Error('Опишите болезнь или самочувствие.');if(!['self_reported','clinician'].includes(basis))throw Error('Укажите, кем описано состояние.');if(!['unknown','ongoing','ended'].includes(status))throw Error('Неизвестное состояние эпизода.');
  const observedAt=checkedText(input,'observedAt',original.observedAt||'');if(observedAt){M.observationDate(observedAt,'exact');if(localInput(observedAt,zone).slice(0,10)!==date)throw Error('Дата и точное время эпизода не совпадают в часовом поясе профиля.');}
  const endDate=checkedText(input,'endDate',status!=='ended'&&status!==original.status?'':original.endDate||'');if(endDate&&(M.isoDate(endDate)<date||endDate>localInput(now,zone).slice(0,10)))throw Error('Проверьте дату окончания эпизода.');if(endDate&&status!=='ended')throw Error('Для даты окончания укажите завершённый эпизод.');
  let next={...original,id:original.id||M.id(),title,date,observedAt,diagnosisBasis:basis,symptoms:checkedText(input,'symptoms',original.symptoms),treatments:checkedText(input,'treatments',original.treatments),context:checkedText(input,'context',original.context),notes:checkedText(input,'notes',original.notes),endDate,status,version:(original.version||0)+1,createdAt:original.createdAt||new Date(now).toISOString(),updatedAt:new Date(now).toISOString()};
  if(!original.id||status!==original.status){next.confirmedAt=status==='unknown'?'':new Date(now).toISOString();next.confirmedUntil=status==='ongoing'?reviewTime(now,zone,Number(input.reviewDays||3)):'';next.nextPromptAt=next.confirmedUntil;}
  return next;
 }
 function answerEpisode(record,action,{days,endDate='',now=new Date(),zone='UTC'}={}){
  const next={...record,version:(record.version||0)+1,updatedAt:new Date(now).toISOString()};
  if(action==='ongoing'){if(endDate)throw Error('Для продолжающегося эпизода дата окончания не задаётся.');next.status='ongoing';next.endDate='';next.confirmedAt=new Date(now).toISOString();next.confirmedUntil=reviewTime(now,zone,Number(days||3));next.nextPromptAt=next.confirmedUntil;}
  else if(action==='ended'){if(days)throw Error('Для завершённого эпизода повторный вопрос не нужен.');if(endDate&&(M.isoDate(endDate)<(record.observedAt?localInput(record.observedAt,zone).slice(0,10):record.date)||endDate>localInput(now,zone).slice(0,10)))throw Error('Проверьте дату окончания эпизода.');next.status='ended';next.endDate=endDate;next.confirmedAt=new Date(now).toISOString();next.confirmedUntil='';next.nextPromptAt='';}
  else if(action==='snooze'){if(episodeState(record,now).status==='ended'||endDate)throw Error('Завершённый эпизод нельзя отложить.');next.nextPromptAt=reviewTime(now,zone,Number(days||1));}
  else throw Error('Выберите ответ о состоянии эпизода.');return next;
 }
 function measurement(record){return {...record,version:Number(record.version||0),observedAt:record.observedAt||'',context:record.context||'',episodeId:record.episodeId||''};}
 function timePoint(record){return Date.parse(record.observedAt||record.date+'T12:00:00Z');}
 function formInput(input,original,zone){const next={...input,timezone:zoneName(zone)};if(Object.hasOwn(input,'localTime')){const wall=input.date+'T'+input.localTime,at=original?.observedAt;next.observedAt=input.localTime?(at&&localInput(at,zone)===wall&&!input.offset?at:timestamp(wall,zone,input.offset||'')):'';}return next;}
 function checkVital(input,original){original=measurement(original||{});const type=checkedText(input,'type',original.type||''),definition=definitions[type];if(!definition)throw Error('Выберите вид показателя.');const value=checkedText(input,'value',original.value||'',90);let numbers;
  if(type==='Давление'){const match=/^\s*([\d.,]+)\s*\/\s*([\d.,]+)\s*$/.exec(value);numbers=match?[M.number(match[1]),M.number(match[2])]:[];if(numbers.length!==2||numbers.some(x=>x===null||x<=0||x>10000)||numbers[1]>numbers[0])throw Error('Давление: например 120/80; нижнее должно быть положительным и не выше верхнего.');}
  else {numbers=[M.number(value)];const n=numbers[0],allowZero=['Сон','Шаги'].includes(type);if(n===null||n<(allowZero?0:Number.MIN_VALUE)||n>(type==='Шаги'?200000:type==='Сон'?24:type==='Сатурация'?100:10000))throw Error('Проверьте числовое значение показателя.');}
  const unit=String(input.unit??(original.type===type&&original.unit?original.unit:definition.unit));if(type==='Глюкоза'?!['ммоль/л','мг/дл'].includes(unit):unit!==definition.unit)throw Error('Единица не соответствует виду измерения.');
  const date=M.isoDate(input.date??original.date),observedAt=checkedText(input,'observedAt',original.observedAt||'');if(observedAt){M.observationDate(observedAt,'exact');const zone=zoneName(input.timezone);if(localInput(observedAt,zone).slice(0,10)!==date)throw Error('Дата и точное время измерения не совпадают в часовом поясе профиля.');}
  return {...original,id:original.id||M.id(),type,value,date,observedAt,unit,context:checkedText(input,'context',original.context),notes:checkedText(input,'notes',original.notes),episodeId:checkedText(input,'episodeId',original.episodeId||''),version:(original.version||0)+1,createdAt:original.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
 }
 window.HumanHealth={definitions,zoneName,localInput,shiftDay,timestamp,reviewTime,episodes,episodeState,label,checkEpisode,answerEpisode,measurement,timePoint,checkVital,formInput};
})();
