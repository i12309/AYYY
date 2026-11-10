/* HUMAN model: explicit source values, reference ranges and non-destructive grouping. */
(() => {
  'use strict';
  function id(){return crypto.randomUUID();}
  function text(value,max=300){return String(value??'').trim().slice(0,max);}
  function isoDate(value){
    const s=text(value,20);
    if(!/^\d{4}-\d\d-\d\d$/.test(s) || Number.isNaN(Date.parse(s+'T12:00:00Z')))
      throw new Error('Укажите корректную дату.');
    return s;
  }
  function number(value){
    const s=String(value??'').trim().replace(',','.');
    if(!s || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(s))return null;
    const n=Number(s);
    return Number.isFinite(n)?n:null;
  }
  function checkLab(input,original){
    const name=text(input.name,180),value=text(input.value,100);
    if(!name || !value)throw new Error('Название показателя и результат обязательны.');
    const low=text(input.low,50),high=text(input.high,50);
    if((low && number(low)===null)||(high && number(high)===null))
      throw new Error('Референсы должны содержать числа или оставаться пустыми.');
    if(low&&high&&number(low)>number(high))throw new Error('Нижняя граница больше верхней.');
    return {id:original?.id||id(),date:isoDate(input.date),name,value,
      unit:text(input.unit,50),low,high,source:text(input.source,180),
      material:text(input.material,90),method:text(input.method,90),
      notes:text(input.notes,3000),createdAt:original?.createdAt||new Date().toISOString(),
      updatedAt:new Date().toISOString()};
  }
  function checkVital(input,original){
    const type=text(input.type,100),value=text(input.value,90);
    if(!type||!value)throw new Error('Выберите вид показателя и укажите значение.');
    const valid=type==='Давление' ? /^\d{2,3}\s*\/\s*\d{2,3}$/.test(value) : number(value)!==null;
    if(!valid)throw new Error(type==='Давление'?'Формат давления: 120/80.':'Введите числовое значение.');
    const units={'Давление':'мм рт. ст.','Пульс':'уд/мин','Масса':'кг','Температура':'°C',
      'Глюкоза':'ммоль/л','Сон':'ч','Шаги':'шагов','Рост':'см'};
    return {id:original?.id||id(),date:isoDate(input.date),type,value,
      unit:units[type]||text(input.unit,50),notes:text(input.notes,1000),
      createdAt:original?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
  }
  function checkMedical(input,original){
    const category=text(input.category,40),title=text(input.title,200);
    if(!['allergy','condition','vaccine','surgery','other'].includes(category)||!title)
      throw new Error('Выберите категорию и укажите название.');
    return {id:original?.id||id(),category,title,date:input.date?isoDate(input.date):'',
      notes:text(input.notes,3000),createdAt:original?.createdAt||new Date().toISOString(),
      updatedAt:new Date().toISOString()};
  }
  function checkMedication(input,original){
    const name=text(input.name,180);
    if(!name)throw new Error('Укажите название препарата.');
    return {id:original?.id||id(),name,dose:text(input.dose,100),frequency:text(input.frequency,150),
      startDate:input.startDate?isoDate(input.startDate):'',notes:text(input.notes,3000),
      createdAt:original?.createdAt||new Date().toISOString(),
      updatedAt:new Date().toISOString()};
  }
  function checkDiary(input,original){
    const kind=text(input.kind,40),title=text(input.title,250);
    if(!['food','activity','wellbeing','sleep'].includes(kind)||!title)
      throw new Error('Укажите вид и содержание записи.');
    return {id:original?.id||id(),date:isoDate(input.date),kind,title,
      notes:text(input.notes,3000),createdAt:original?.createdAt||new Date().toISOString(),
      updatedAt:new Date().toISOString()};
  }
  function groupKey(r){
    return [r.name,r.unit,r.material,r.method].map(s=>text(s).toLocaleLowerCase('ru-RU').replace(/\s+/g,' ')).join('\u001f');
  }
  function groups(records){
    const map=new Map();
    for(const row of records){
      const key=groupKey(row);
      if(!map.has(key))map.set(key,{key,name:row.name,unit:row.unit,rows:[]});
      map.get(key).rows.push(row);
    }
    return [...map.values()].map(group=>{
      group.rows.sort((a,b)=>b.date.localeCompare(a.date)||b.updatedAt.localeCompare(a.updatedAt));
      group.latest=group.rows[0];
      group.status=status(group.latest);
      return group;
    }).sort((a,b)=>b.latest.date.localeCompare(a.latest.date)||a.name.localeCompare(b.name,'ru'));
  }
  function status(row){
    if(!row)return 'unknown';
    const v=number(row.value),low=number(row.low),high=number(row.high);
    if(v===null||(low===null&&high===null))return 'unknown';
    if((low!==null&&v<low)||(high!==null&&v>high))return 'abnormal';
    return 'normal';
  }
  function chartRows(rows){
    return rows.filter(row=>number(row.value)!==null&&/^\d{4}-\d\d-\d\d$/.test(row.date))
      .slice().sort((a,b)=>a.date.localeCompare(b.date));
  }
  function recent(items,limit=6){
    return items.slice().sort((a,b)=>(b.date||b.startDate||b.createdAt||'').localeCompare(
      a.date||a.startDate||a.createdAt||'')).slice(0,limit);
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
      method:['method','метод'],notes:['notes','комментарий','примечание']
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
  window.HumanModel={id,text,isoDate,number,checkLab,checkVital,checkMedical,checkMedication,
    checkDiary,groupKey,groups,status,chartRows,recent,parseCSV};
})();