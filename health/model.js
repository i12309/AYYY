/* HUMAN model: explicit source values, reference ranges and non-destructive grouping. */
(() => {
  'use strict';
  const A=window.HumanAnalytes;
  function id(){return crypto.randomUUID();}
  function text(value,max=300){return String(value??'').trim().slice(0,max);}
  function isoDate(value){
    const s=text(value,20);
    if(!/^\d{4}-\d\d-\d\d$/.test(s))throw new Error('Укажите корректную дату.');
    const parsed=new Date(s+'T12:00:00Z');
    if(Number.isNaN(+parsed)||parsed.toISOString().slice(0,10)!==s)
      throw new Error('Укажите корректную дату.');
    return s;
  }
  function number(value){
    const s=String(value??'').trim().replace(',','.');
    if(!s || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(s))return null;
    const n=Number(s);
    return Number.isFinite(n)?n:null;
  }
  function observationDate(value,precision){
    const raw=text(value,64),kind=precision||(/^\d{4}$/.test(raw)?'year':/^\d{4}-\d{2}$/.test(raw)?'month':'day');
    if(kind==='unknown'){if(raw)throw new Error('Для неизвестной даты оставьте поле пустым.');return {date:'',datePrecision:kind};}
    if(kind==='year'&&/^\d{4}$/.test(raw)&&Number(raw)>0)return {date:raw,datePrecision:kind};
    if(kind==='month'&&/^\d{4}-\d{2}$/.test(raw)){isoDate(raw+'-01');return {date:raw,datePrecision:kind};}
    if(kind==='exact'){if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(raw)||!Number.isFinite(Date.parse(raw)))throw new Error('Точное время должно включать часовой пояс.');isoDate(raw.slice(0,10));return {date:raw,datePrecision:kind};}
    if(kind==='day')return {date:isoDate(raw),datePrecision:kind};
    throw new Error('Дата не соответствует выбранной точности.');
  }
  function checkPreferences(input,original={}){
    const low=text(input.low,100),high=text(input.high,100);
    if((low&&number(low)===null)||(high&&number(high)===null)||(low&&high&&number(low)>number(high)))throw new Error('Проверьте числовые границы референса.');
    return {...original,low,high,unit:text(input.unit,100),note:text(input.note,2000),useReference:input.useReference==='yes',updatedAt:new Date().toISOString()};
  }
  function referenceRow(row,preferences){return preferences?.useReference&&preferences.unit===row.unit?{...row,low:preferences.low,high:preferences.high}:row;}
  function labValueKind(value){
    const raw=String(value??'').trim();
    return number(raw)!==null?'quantity':/^[<>≤≥]/.test(raw)?'censored':/^[+-]?[\d.,]+\s*[-–]\s*[+-]?[\d.,]+$/.test(raw)?'range':'qualitative';
  }
  function checkLab(input,original){
    for(const [key,max] of Object.entries({name:200,value:8000,canonicalName:200,unit:100,low:100,high:100,source:1000,material:1000,method:1000,notes:8000}))if(String(input[key]??'').trim().length>max)throw new Error('Поле '+key+' превышает '+max+' символов. Сократите его перед сохранением.');
    const name=text(input.name,200),value=text(input.value,8000);
    if(!name || !value)throw new Error('Название показателя и результат обязательны.');
    const low=text(input.low,100),high=text(input.high,100);
    if((low && number(low)===null)||(high && number(high)===null))
      throw new Error('Референсы должны содержать числа или оставаться пустыми.');
    if(low&&high&&number(low)>number(high))throw new Error('Нижняя граница больше верхней.');
    const row={...original,id:original?.id||id(),...observationDate(input.date,input.datePrecision),name,value,
      canonicalName:text(input.canonicalName,200),reviewStatus:'confirmed_manual',valueKind:labValueKind(value),
      unit:text(input.unit,100),low,high,source:text(input.source,1000),
      material:text(input.material,1000),method:text(input.method,1000),
      notes:text(input.notes,8000),createdAt:original?.createdAt||new Date().toISOString(),
      updatedAt:new Date().toISOString()};
    if(row.unitHistory&&(row.unit||!A.unitEligible(row)||
       ['name','canonicalName','material','method'].some(key=>row[key]!==original?.[key])))delete row.unitHistory;
    return row;
  }
  function checkVital(input,original){return window.HumanHealth.checkVital(input,original);}
  const clinicalStatuses={allergy:['unknown','active','inactive'],medication:['unknown','planned','active','paused','completed'],vaccine:['completed'],condition:['unknown','active','remission','resolved'],surgery:['unknown','planned','completed'],other:['unknown','active','resolved']};
  function partialDate(value,precision){
    const raw=String(value??'').trim(),inferred=!raw?'unknown':/^\d{4}$/.test(raw)?'year':/^\d{4}-\d\d$/.test(raw)?'month':'day';
    const result=observationDate(raw,precision||inferred);if(result.datePrecision==='exact'||(raw&&(Number(raw.slice(0,4))<1850||Number(raw.slice(0,4))>2200)))throw Error('Дата медкарты должна быть между 1850 и 2200 годами.');
    return {value:result.date,precision:result.datePrecision};
  }
  function clinical(record={},kind='medical'){
    record=record||{};const category=kind==='medication'?'medication':record.category||'allergy';
    const oldDate=String(record.date||record.startDate||'');const start=record.start||{value:oldDate,precision:!oldDate?'unknown':/^\d{4}$/.test(oldDate)?'year':/^\d{4}-\d\d$/.test(oldDate)?'month':'day'},end=record.end||{value:'',precision:'unknown'};
    return {category,name:kind==='medication'?record.name||'':record.title||'',status:record.status||(category==='vaccine'?'completed':'unknown'),basis:record.basis||'self_reported',start,end,notes:record.notes||'',documentId:record.documentId||'',episodeId:record.episodeId||'',allergy:record.allergy||{reaction:'',severity:'unknown'},medication:record.medication||{category:'medication',dose:record.dose||'',schedule:record.frequency||'',route:'',indication:''},vaccination:record.vaccination||{against:'',dose_label:'',lot:'',place:''},condition:record.condition||{description:''}};
  }
  function clinicalBounds(d){if(!d.value)return null;const first=d.precision==='year'?d.value+'-01-01':d.precision==='month'?d.value+'-01':d.value;const last=d.precision==='year'?d.value+'-12-31':d.precision==='month'?new Date(Date.UTC(Number(d.value.slice(0,4)),Number(d.value.slice(5,7)),0)).toISOString().slice(0,10):d.value;return {first,last};}
  function validateClinical(input,original,kind){
    const previous=clinical(original,kind),category=kind==='medication'?'medication':String(input.category||previous.category),name=String(kind==='medication'?input.name??previous.name:input.title??previous.name).trim();
    if(!clinicalStatuses[category]||!name||Array.from(name).length>200)throw Error('Выберите категорию и название до 200 символов.');
    const status=String(input.status??(category===previous.category?previous.status:clinicalStatuses[category][0])),basis=String(input.basis??previous.basis);
    if(!clinicalStatuses[category].includes(status))throw Error('Статус не соответствует категории записи.');if(!['self_reported','clinician'].includes(basis))throw Error('Укажите источник сведений.');
    const start=partialDate(input.start??input.date??input.startDate??previous.start.value,input.startPrecision??(['start','date','startDate'].some(key=>Object.hasOwn(input,key))?undefined:previous.start.precision)),end=category==='vaccine'&&!Object.hasOwn(input,'end')?{value:'',precision:'unknown'}:partialDate(input.end??previous.end.value,input.endPrecision??(Object.hasOwn(input,'end')?undefined:previous.end.precision)),a=clinicalBounds(start),b=clinicalBounds(end);
    if(a&&b&&b.last<a.first)throw Error('Окончание не может быть раньше начала.');if(category==='vaccine'&&end.precision!=='unknown')throw Error('У прививки должна быть одна дата введения.');
    function field(key,fallback=''){const value=String(input[key]??fallback).trim();if(Array.from(value).length>4000&&value!==String(fallback).trim())throw Error('Поле '+key+' превышает 4000 символов.');return value;}
    let allergy=null,medication=null,vaccination=null,condition=null;
    if(category==='allergy'){const severity=field('severity',previous.allergy.severity);if(!['unknown','mild','moderate','severe'].includes(severity))throw Error('Проверьте тяжесть реакции.');allergy={reaction:field('reaction',previous.allergy.reaction),severity};}
    if(category==='medication'){const type=field('medicationCategory',previous.medication.category);if(!['medication','supplement'].includes(type))throw Error('Укажите лекарство или добавку.');medication={category:type,dose:field('dose',previous.medication.dose),schedule:field('frequency',previous.medication.schedule),route:field('route',previous.medication.route),indication:field('indication',previous.medication.indication)};}
    if(category==='vaccine')vaccination={against:field('against',previous.vaccination.against),dose_label:field('doseLabel',previous.vaccination.dose_label),lot:field('lot',previous.vaccination.lot),place:field('place',previous.vaccination.place)};
    if(['condition','surgery','other'].includes(category))condition={description:field('description',previous.condition.description)};
    const common={...original,id:original?.id||id(),status,basis,start,end,date:start.value,notes:field('notes',previous.notes),documentId:field('documentId',previous.documentId),episodeId:field('episodeId',previous.episodeId),allergy,medication,vaccination,condition,createdAt:original?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
    return kind==='medication'?{...common,name,dose:medication.dose,frequency:medication.schedule,startDate:start.value}:{...common,category,title:name};
  }
  function checkMedical(input,original){return validateClinical(input,original,'medical');}
  function checkMedication(input,original){return validateClinical(input,original,'medication');}
  function checkDiary(input,original){
    const kind=text(input.kind,40),title=text(input.title,250);
    if(!['wellbeing','sleep'].includes(kind)||!title)
      throw new Error('Укажите вид и содержание записи.');
    return {...original,id:original?.id||id(),date:isoDate(input.date),kind,title,
      notes:text(input.notes,8000),createdAt:original?.createdAt||new Date().toISOString(),
      updatedAt:new Date().toISOString()};
  }
  function groupKey(row,rules={}){
    return JSON.stringify([A.context(row,rules),A.effectiveUnit(row,rules)]);
  }
  function groups(records,preferences={},rules={}){
    const map=new Map();
    for(const row of records){
      const match=A.classify(row,rules),unit=A.effectiveUnit(row,rules);
      const key=JSON.stringify([A.context(row,rules,match),unit]);
      if(!map.has(key))map.set(key,{key,name:match.name,unit,match,favoriteKey:A.favoriteKey(match),rows:[]});
      map.get(key).rows.push(unit!==row.unit?{...row,unit,reportedUnit:row.unit||''}:row);
    }
    return [...map.values()].map(group=>{
      group.rows.sort((a,b)=>sortKey(b).localeCompare(sortKey(a))||String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
      group.latest=group.rows[0];
      const local=preferences[group.key]||{};
      group.preferences={...local,favorite:preferences[group.favoriteKey]?.favorite??local.favorite};
      group.effectiveLatest=referenceRow(group.latest,group.preferences);
      group.status=status(group.effectiveLatest);
      return group;
    }).sort((a,b)=>b.latest.date.localeCompare(a.latest.date)||a.name.localeCompare(b.name,'ru'));
  }
  function status(row){
    if(!row || row.reviewStatus==='draft' || !text(row.unit))return 'unknown';
    const v=number(row.value),low=number(row.low),high=number(row.high);
    if(v===null||(low===null&&high===null))return 'unknown';
    if((low!==null&&v<low)||(high!==null&&v>high))return 'abnormal';
    return 'normal';
  }
  function timestamp(row){return Date.parse(row.datePrecision==='exact'?row.date:row.date+'T12:00:00Z');}
  function numericRows(rows){return rows.filter(row=>row.reviewStatus!=='draft'&&text(row.unit)&&number(row.value)!==null);}
  function chartRows(rows){return numericRows(rows).filter(row=>row.datePrecision==='exact'?Number.isFinite(timestamp(row)):/^\d{4}-\d\d-\d\d$/.test(row.date)).sort((a,b)=>timestamp(a)-timestamp(b));}
  function sortKey(row){return row.datePrecision==='exact'&&Number.isFinite(timestamp(row))?new Date(timestamp(row)).toISOString():row.date||row.startDate||row.createdAt||'';}
  function recent(items,limit=6){
    return items.slice().sort((a,b)=>sortKey(b).localeCompare(sortKey(a))).slice(0,limit);
  }
  function parseCSV(raw){
    if(typeof raw!=='string'||raw.length>2*1024*1024)throw new Error('CSV слишком большой (максимум 2 МиБ).');
    const first=(raw.replace(/^\uFEFF/,'').split(/\r?\n/,1)[0]||'');
    const sep=(first.match(/;/g)||[]).length>=(first.match(/,/g)||[]).length?';':',';
    const all=[];let field='',row=[],quoted=false;
    const src=raw.replace(/^\uFEFF/,'');
    for(let i=0;i<src.length;i++){
      const ch=src[i];
      if(ch==='"'){
        if(quoted&&src[i+1]==='"'){field+='"';i++;}
        else quoted=!quoted;
      }else if(ch===sep&&!quoted){row.push(field);field='';}
      else if((ch==='\n'||ch==='\r')&&!quoted){
        if(ch==='\r'&&src[i+1]==='\n')i++;
        row.push(field);field='';
        if(row.some(cell=>cell.trim()))all.push(row);
        row=[];
      }else field+=ch;
    }
    if(quoted)throw new Error('CSV содержит незакрытую кавычку.');
    row.push(field);if(row.some(cell=>cell.trim()))all.push(row);
    if(all.length<2)throw new Error('В CSV нет строк с результатами.');
    if(all.length>3001)throw new Error('За один раз можно импортировать до 3000 строк.');
    const aliases={
      date:['date','дата'],name:['name','название','показатель','анализ'],
      value:['value','result','значение','результат'],unit:['unit','единица','ед.изм.'],
      low:['low','min','нижняя граница','мин'],high:['high','max','верхняя граница','макс'],
      source:['source','лаборатория','источник'],material:['material','материал'],
      datePrecision:['dateprecision','точность даты'],canonicalName:['canonicalname','показатель в каталоге'],method:['method','метод'],notes:['notes','комментарий','примечание']
    };
    const header=all.shift().map(v=>v.trim().toLocaleLowerCase('ru-RU'));
    const column={};
    for(const [key,names] of Object.entries(aliases))column[key]=header.findIndex(h=>names.includes(h));
    if(['date','name','value'].some(x=>column[x]<0))
      throw new Error('CSV должен содержать колонки date, name, value (или дата, показатель, результат).');
    const records=[],errors=[];
    all.forEach((line,i)=>{
      const object={};
      for(const [key,index] of Object.entries(column))object[key]=index<0?'':line[index]||'';
      try{records.push(checkLab(object));}
      catch(error){errors.push({line:i+2,reason:error.message});}
    });
    return {records,errors};
  }
  window.HumanModel={clinical,clinicalStatuses,partialDate,id,text,isoDate,number,timestamp,observationDate,checkPreferences,referenceRow,labValueKind,checkLab,checkVital,checkMedical,checkMedication,
    checkDiary,groupKey,groups,status,numericRows,chartRows,recent,parseCSV};
})();
