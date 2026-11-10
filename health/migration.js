/* Read-only HUMAN v2 export migration. Original archive is retained byte-for-byte. */
(() => {
 'use strict';
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const decoder=new TextDecoder('utf-8',{fatal:true}),str=x=>x==null?'':String(x);
 const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
 let sqlite;
 const normalize=s=>{const notation={'⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','⁺':'+','⁻':'-'};const chars=Array.from(str(s).toLowerCase().replaceAll('ё','е').replace(/[₀-₉]/g,c=>String(c.charCodeAt(0)-8320)).replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]/g,c=>notation[c]).trim());return chars.map((c,i)=>/[\p{L}\p{N}%+<>=≤≥/]/u.test(c)||((c==='-'||c==='−')&&i===chars.length-1)?c:' ').join('').trim().replace(/\s+/g,' ');};
 function jsonPayload(row){try{const p=JSON.parse(row.payload);if(!p||typeof p!=='object'||Array.isArray(p))throw Error();return p;}catch{throw Error('Некорректный payload в исходной базе.');}}
 function dateOf(o){const precision=o.time_precision||'day';
  if(precision==='unknown')return {date:'',datePrecision:precision};
  if(precision==='exact')return HumanModel.observationDate(o.observed_at,'exact');
  const raw=o.observed_date;if(!raw)throw Error('Не найдена исходная календарная дата анализа.');
  return HumanModel.observationDate(precision==='year'?raw.slice(0,4):precision==='month'?raw.slice(0,7):raw,precision);
 }
 function valueOf(o){switch(o.value_kind||'quantity'){
  case 'quantity':if(o.value==null||!Number.isFinite(o.value))throw Error('Не найдено числовое значение анализа.');return String(o.value);
  case 'censored':{const sign={lt:'<',le:'≤',gt:'>',ge:'≥'}[o.comparator];if(!sign||o.value==null||!Number.isFinite(o.value))throw Error('Не определён предел измерения.');return sign+' '+o.value;}
  case 'qualitative':if(o.qualitative_value==null)throw Error('Не найден качественный результат.');return str(o.qualitative_value);
  case 'range':if(o.range_low==null||o.range_high==null)throw Error('Не найдены границы результата.');return o.range_low+' — '+o.range_high;
  default:throw Error('Неизвестный вид результата HUMAN.');
 }}
 async function inspect(file){
  if(!file||file.size>16*1024*1024)throw Error('Экспорт HUMAN должен быть ZIP до 16 МиБ.');
  const bytes=new Uint8Array(await file.arrayBuffer()),files=await HumanDocuments.unzip(bytes,{raw:true});
  if(!files.has('manifest.json')||!files.has('human.db'))throw Error('Нужен пользовательский экспорт HUMAN v2 (manifest.json и human.db).');
  for(const name of files.keys())if(name!=='manifest.json'&&name!=='human.db'&&!/^files\/[0-9a-f-]{36}\/original$/i.test(name))throw Error('Неизвестный файл в экспорте HUMAN.');
  const manifestBytes=await files.get('manifest.json')();if(manifestBytes.length>1024*1024)throw Error('Слишком большой манифест.');
  const manifest=JSON.parse(decoder.decode(manifestBytes));
  if(manifest.format!=='human-user'||manifest.version!==2||!UUID.test(manifest.user_id)||!manifest.entries||Object.keys(manifest.entries).length!==files.size-1)throw Error('Неверный манифест HUMAN v2.');
  const entries=new Map();
  for(const [name,info] of Object.entries(manifest.entries)){
   if(name==='manifest.json'||!files.has(name)||!Number.isSafeInteger(info.size)||info.size<0||!/^[a-f0-9]{64}$/i.test(info.sha256))throw Error('Манифест не соответствует архиву.');
   const data=await files.get(name)();if(data.length!==info.size||await hash(data)!==info.sha256.toLowerCase())throw Error('Контрольная сумма не совпадает: '+name);entries.set(name,data);
  }
  if(!entries.has('human.db'))throw Error('База не указана в манифесте.');
  const dbBytes=entries.get('human.db');if(decoder.decode(dbBytes.slice(0,16))!=='SQLite format 3\0')throw Error('Неизвестный формат базы HUMAN.');
  sqlite??=window.initSqlJs({locateFile:name=>new URL('./vendor/sqljs/'+name,location.href).href});
  const SQL=await sqlite,db=new SQL.Database(dbBytes),tables=Object.create(null);let total=0;
  try{
   db.run('PRAGMA trusted_schema=OFF; PRAGMA query_only=ON;');
   if(db.exec('PRAGMA foreign_key_check')[0]?.values?.length)throw Error('В базе нарушены связи записей.');
   const integrity=db.exec('PRAGMA quick_check');if(integrity[0]?.values?.[0]?.[0]!=='ok')throw Error('SQLite не прошла проверку целостности.');
   const statement=db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'");const names=[];while(statement.step()){names.push(statement.getAsObject().name);}statement.free();
   if(names.length>100)throw Error('Неизвестная структура базы HUMAN.');
   for(const name of names){if(!/^[a-z_]+$/.test(name))throw Error('Неподдерживаемая таблица HUMAN.');const query=db.prepare('SELECT * FROM "'+name+'"'),rows=[];try{while(query.step()){if(++total>100000)throw Error('В экспорте больше 100 000 записей.');const row=query.getAsObject(null,{useBigInt:true});for(const key in row){if(typeof row[key]==='bigint')row[key]=row[key].toString();else if(row[key] instanceof Uint8Array)row[key]={base64:HumanCrypto.base64(row[key])};}rows.push(row);}}finally{query.free();}tables[name]=rows;}
  }finally{db.close();}
  if(!tables.profile||!tables.observations||!tables.documents||!tables.schema_migrations)throw Error('Не найдены основные таблицы HUMAN.');
  const schema=await (await fetch('./human-schema.json')).json();for(const row of tables.schema_migrations)if(!schema[row.version]?.includes(row.checksum))throw Error('Неизвестная версия схемы HUMAN: '+row.version);
  const catalog=await (await fetch('./analytes.json')).json();const lookup=new Map(),definitions=new Map();for(const d of catalog.definitions){definitions.set(d.id,d);for(const name of [d.name,...d.aliases])lookup.set(normalize(name),d);}
  const latest=(rows,key)=>{const map=new Map();for(const r of rows||[])if(!map.has(r[key])||Number(r.version)>Number(map.get(r[key]).version))map.set(r[key],r);return map;};
  const aliases=latest(tables.analyte_aliases,'normalized_name'),settings=latest(tables.analyte_settings,'analyte_id'),favorites=new Map((tables.analyte_favorites||[]).map(r=>[r.analyte_id,Number(r.favorite)===1]));
  const deleted=new Set((tables.observation_deletions||[]).map(x=>x.observation_id));const profile=tables.profile[0]?jsonPayload(tables.profile[0]):{};
  for(const key of ['name','birth_date','sex_at_birth','timezone'])if(profile[key]!=null&&typeof profile[key]!=='string')throw Error('Неверный тип поля профиля HUMAN.');
  const doc={schema:1,id:'',profile:{name:profile.name||'',birthDate:profile.birth_date||'',sex:profile.sex_at_birth||'',timezone:profile.timezone||'',heightCm:profile.height_cm??null,notes:''},observations:[],vitals:[],medical:[],medications:[],diary:[],documents:[],revisions:[],analytePreferences:{}};
  const retained={};
  for(const row of tables.observations){if(deleted.has(row.id))continue;const o=jsonPayload(row),documentId=o.source?.document_id||'',name=normalize(o.name),local=aliases.get('document:'+documentId+':'+name),global=aliases.get(name),alias=local||global;
   const match=alias?definitions.get(jsonPayload(alias).analyte_id):lookup.get(name),unclassified='name-'+(await hash(new TextEncoder().encode(name))).slice(0,24),analyteId=alias?jsonPayload(alias).analyte_id:match?.id||unclassified;
   for(const key of ['name','unit','laboratory','specimen','method','notes','created_at'])if(o[key]!=null&&typeof o[key]!=='string')throw Error('Неверный тип поля анализа HUMAN.');if(!o.name)throw Error('Не найдено название анализа HUMAN.');
   const record={id:row.id,name:o.name,canonicalName:match?.name||'',...dateOf(o),value:valueOf(o),unit:o.unit||'',low:str(o.reference_low),high:str(o.reference_high),source:o.laboratory||'',material:o.specimen||'',method:o.method||'',notes:o.notes||'',documentId,reviewStatus:o.review_status||row.review_status,valueKind:o.value_kind||'quantity',createdAt:o.created_at||'',updatedAt:o.created_at||'',human:o};
   doc.observations.push(record);const saved=settings.get(analyteId),pref=saved?jsonPayload(saved):null,key=HumanModel.groupKey(record);
   if(pref&&pref.unit===record.unit)doc.analytePreferences[key]={unit:pref.unit,low:str(pref.reference_low),high:str(pref.reference_high),note:pref.note||'',useReference:true,favorite:favorites.get(analyteId)||false};
   else if(favorites.get(analyteId))doc.analytePreferences[key]={favorite:true};
  }
  for(const row of tables.documents){if(row.status!=='ready')continue;const path='files/'+row.id+'/original',data=entries.get(path),meta=manifest.entries[path];if(!data||!meta||data.length!==Number(row.size)||meta.sha256.toLowerCase()!==str(row.sha256).toLowerCase())throw Error('Документ не соответствует SQLite: '+row.id);
   const o=jsonPayload(row);doc.documents.push({id:row.id,name:row.original_filename,title:o.title||row.original_filename,date:str(row.received_at).slice(0,10),mime:row.mime_type,size:data.length,sha256:meta.sha256,data:HumanCrypto.base64(data),createdAt:row.received_at,updatedAt:row.received_at,human:o});
  }
  if(entries.size!==doc.documents.length+1)throw Error('В архиве есть документы, не связанные с базой.');
  for(const row of tables.health_records||[]){if(Number(row.deleted))continue;const o=jsonPayload(row),type={weight:'Масса',height:'Рост',pressure:'Давление',pulse:'Пульс',temperature:'Температура',oxygen:'Сатурация',respiration:'Частота дыхания',glucose:'Глюкоза'}[o.kind];
   if(type)doc.vitals.push({id:row.id,type,date:window.HumanHealth.localInput(o.observed_at,doc.profile.timezone).slice(0,10),observedAt:o.observed_at,context:o.context||'',episodeId:o.episode_id||'',value:o.kind==='pressure'?str(o.value)+'/'+str(o.secondary):str(o.value),unit:o.unit||'',notes:o.notes||'',human:o,createdAt:o.created_at||'',updatedAt:o.updated_at||''});else retained.health_records=(retained.health_records||0)+1;
  }
  for(const row of tables.medical_records||[]){if(Number(row.deleted))continue;const o=jsonPayload(row),start=o.start||{},date=start.precision==='year'?str(start.value).slice(0,4):start.precision==='month'?str(start.value).slice(0,7):start.precision==='unknown'?'':str(start.value);
   if(o.kind==='medication')doc.medications.push({id:row.id,name:o.name,dose:o.medication?.dose||'',frequency:o.medication?.schedule||'',startDate:date,notes:o.notes||'',human:o,createdAt:o.created_at||'',updatedAt:o.updated_at||''});
   else doc.medical.push({id:row.id,category:{vaccination:'vaccine',allergy:'allergy',condition:'condition'}[o.kind]||'other',title:o.name,date,notes:o.notes||'',human:o,createdAt:o.created_at||'',updatedAt:o.updated_at||''});
  }
  for(const row of tables.journal_entries||[]){if(Number(row.deleted))continue;const o=jsonPayload(row);doc.diary.push({id:row.kind+':'+row.id,kind:row.kind==='meal'?'food':'activity',date:row.kind==='meal'?str(o.eaten_at).slice(0,10):o.date||'',title:o.description||o.activity_type||row.title||'',notes:o.notes||'',human:o,createdAt:o.created_at||'',updatedAt:o.updated_at||''});}
  for(const [table,rows] of Object.entries(tables))if(table.endsWith('_revisions'))for(const row of rows)doc.revisions.push({id:table+':'+(row.id||doc.revisions.length),kind:'human:'+table,previous:row.snapshot?JSON.parse(row.snapshot):row,changedAt:row.changed_at||'',human:row});
  const archiveHash=await hash(bytes),counts=Object.fromEntries(Object.entries(tables).map(([k,v])=>[k,v.length]));
  doc.humanMigration={format:'human-user',version:2,userId:manifest.user_id,archiveHash,archiveName:file.name,originalArchive:HumanCrypto.base64(bytes),manifest,counts,tables,retained,importedAt:new Date().toISOString()};
  doc.intakes=window.HumanCare.records(doc,'intake');doc.reminders=window.HumanCare.records(doc,'reminder');doc.carePreferences={browser_enabled:false};
  doc.episodes=window.HumanHealth.episodes(doc);if(retained.health_records){retained.health_records-=doc.episodes.length;if(!retained.health_records)delete retained.health_records;}
  const size=new TextEncoder().encode(JSON.stringify(doc)).length;if(size>28*1024*1024)throw Error('Перенос превышает текущий предел журнала 28 МиБ. Исходный архив не изменён.');
  return {doc,archiveHash,counts,size};
 }
 window.HumanMigration={inspect,dateOf,valueOf};
})();
