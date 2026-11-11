/* Turn a reviewed table into candidate rows, keeping source coordinates. */
(() => {
  'use strict';
  const M=window.HumanModel;
  const dateLike=/^(?:\d{4}(?:-\d{2}(?:-\d{2}(?:T\S+)?)?)?|\d{1,2}[./]\d{1,2}[./]\d{4})$/;
  const day=(year,month,date)=>[year,month.padStart(2,'0'),date.padStart(2,'0')].join('-');
  function date(value,order=''){
    const raw=String(value??'').trim();
    const dot=/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(raw);
    if(dot)return day(dot[3],dot[2],dot[1]);
    const slash=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
    if(slash&&order==='dmy')return day(slash[3],slash[2],slash[1]);
    if(slash&&order==='mdy')return day(slash[3],slash[1],slash[2]);
    return raw;
  }
  function precision(value){
    if(!value)return 'unknown';
    if(/^\d{4}$/.test(value))return 'year';
    if(/^\d{4}-\d{2}$/.test(value))return 'month';
    if(value.includes('T'))return 'exact';
    return 'day';
  }
  function checkedDate(value,order){
    const parsed=date(value,order);
    if(/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(parsed))
      throw Error('Выберите порядок дня и месяца для дат через /.');
    return M.observationDate(parsed,precision(parsed));
  }
  function suggestedLayout(labels,mapping){
    return mapping.value<0&&labels.some((value,index)=>index!==mapping.name&&dateLike.test(value.trim()))
      ?'dates_in_columns':'rows';
  }
  function sourceIdentity(hash,sheet,row,column){
    return hash+':'+sheet+':'+row+':'+column;
  }
  function importedCoordinates(doc){
    const active=new Set(doc.observations.map(row=>row.id));
    return new Set([
      ...doc.observations.flatMap(row=>[row.importKey,row.provenance?.sourceCell].filter(Boolean)),
      ...doc.documents.flatMap(file=>Array.isArray(file.importLinks)?file.importLinks.filter(link=>active.has(link?.observationId)).map(link=>link.sourceCell):[]),
    ]);
  }
  const clean=value=>String(value??'').normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('ru-RU');
  function resultValue(value){
    const text=String(value??'').trim();
    const comparison=/^([<>]=?|[≤≥])\s*(.+)$/.exec(text);
    const number=M.number(comparison?comparison[2]:text);
    if(number===null)return clean(text);
    const sign=comparison?.[1]||'';
    return [sign==='≤'?'<=':sign==='≥'?'>=':sign,number];
  }
  function duplicateKey(row){
    const name=clean(row.name),value=resultValue(row.value);
    if(row.reviewStatus==='draft'||!name||value==='')return '';
    const parsed=checkedDate(row.date);
    const dateValue=parsed.datePrecision==='exact'?Date.parse(parsed.date):parsed.date;
    const bound=raw=>M.number(raw)??clean(raw);
    return JSON.stringify([name,parsed.datePrecision,dateValue,value,bound(row.low),bound(row.high)]);
  }
  function duplicateIndex(observations){
    const items=new Map();
    function key(row){try{return duplicateKey(row);}catch{return '';}}
    function add(row){
      const id=key(row);if(!id)return;
      if(!items.has(id))items.set(id,[]);
      items.get(id).push(row);
    }
    function matches(row,limit=Infinity){
      const unit=value=>String(value??'').replace(/\s+/g,'');
      const compatible=(a,b)=>!a||!b||a===b;
      const found=[];
      for(const existing of items.get(key(row))||[]){
        if(!compatible(unit(row.unit),unit(existing.unit))||
           !['source','material','method'].every(field=>compatible(clean(row[field]),clean(existing[field]))))continue;
        found.push(existing);
        if(found.length>=limit)break;
      }
      return found;
    }
    observations.forEach(add);
    return {add,matches};
  }
  function draft(table,{hash,sheet,header,mapping,layout,order,fallbackDate},fields,imported){
    const headings=table.rows[header-1];
    if(!headings||mapping.name<0)throw Error('Укажите строку заголовка и колонку показателя.');
    if(layout==='rows'&&(mapping.value<0||mapping.value===mapping.name))
      throw Error('Назначьте разные колонки показателя и результата.');
    const used=new Set(fields.filter(key=>key!=='date'&&key!=='value').map(key=>mapping[key]));
    const columns=layout==='dates_in_columns'
      ?headings.flatMap((value,index)=>!used.has(index)&&dateLike.test(value.trim())?[index]:[])
      :[mapping.value];
    if(!columns.length)throw Error('В заголовке не найдены колонки с датами.');
    const dates=new Map();
    if(layout==='dates_in_columns'){
      for(const column of columns)dates.set(column,checkedDate(headings[column],order));
    }
    if(fallbackDate)checkedDate(fallbackDate,order);
    const results=[];
    for(let rowIndex=header;rowIndex<table.rows.length;rowIndex++){
      const raw=table.rows[rowIndex],rawCells=table.provenance?.[rowIndex]||null;
      const cells=Object.fromEntries(fields.map(key=>[key,mapping[key]>=0?(raw[mapping[key]]||''):'']));
      for(const column of columns){
        const value=raw[column]||'';
        if(layout==='dates_in_columns'&&!value.trim())continue;
        const row=table.rowNumbers?.[rowIndex]||rowIndex+1;
        const sourceCell=sourceIdentity(hash,sheet,row,column+1),previousKey=hash+':'+sheet+':'+(rowIndex+1);
        const item={...cells,value};
        const sourceDate=layout==='dates_in_columns'?headings[column]:item.date;
        item.date=dates.get(column)?.date||date(sourceDate||fallbackDate,order);
        item.datePrecision=precision(item.date);
        let problem='';
        try{
          const cell=rawCells?.find(cell=>cell.column===column);
          if(['date','date_formula','error'].includes(cell?.kind)){
            item.value='';
            throw Error(cell.kind==='error'?'Ошибка в исходной ячейке. Введите значение.':'Результат записан как дата Excel. Введите значение.');
          }
          checkedDate(item.date,order);
          M.checkLab(item);
        }catch(error){problem=error.message;}
        if(results.length>=5000)throw Error('Не больше 5000 результатов за импорт.');
        results.push({
          item,problem,duplicate:imported.has(sourceCell)||imported.has(previousKey),importKey:sourceCell,previousKey,
          row,column:column+1,sourceDate,raw,rawCells,
          headerCell:layout==='dates_in_columns'?table.provenance?.[header-1]?.find(cell=>cell.column===column)||null:null,
        });
      }
    }
    if(!results.length)throw Error('После заголовка нет результатов.');
    return results;
  }
  window.HumanImportTable={date,checkedDate,suggestedLayout,importedCoordinates,duplicateIndex,draft};
})();
