/* Turn a reviewed table into candidate rows, keeping source coordinates. */
(() => {
  'use strict';
  const M=window.HumanModel;
  const aliases={
    name:['name','test','analyte','показатель','название','наименование','анализ','исследование'],
    value:['value','result','current result','результат','текущий результат','значение'],
    previous:['previous','previous result','предыдущий','предыдущий результат'],
    date:['date','result date','дата','дата результата'],unit:['unit','units','единица','единицы','ед.','ед. изм.','ед.изм.'],
    low:['low','min','мин','нижняя граница'],high:['high','max','макс','верхняя граница'],
    referenceText:['reference','range','reference range','reference interval','reference values','референс','референсы',
      'референсные','референсные значения','референсный интервал','норма','нормы','нормальные значения','условия референса из бланка'],
    source:['source','laboratory','источник','лаборатория'],material:['material','материал'],method:['method','метод'],
    notes:['notes','comment','комментарий','примечание'],
  };
  const columnLabel=text=>text.trim().replace(/\s+/g,' ').replace(/:$/,'').trimEnd().toLocaleLowerCase('ru-RU');
  const columnIndex=(labels,key)=>labels.findIndex(label=>aliases[key].includes(columnLabel(label)));
  const phrases=new Set(Object.values(aliases).flat().filter(label=>label.includes(' ')));
  const pdfFooter=/^(?:(?:исполнитель|результаты исследований не|performed by|these (?:test )?results (?:are not|should not))(?=\s|[:.!]|$)|внимание!)/iu;
  function pdfHeadings(items){
    const headings=[];
    for(const item of items){
      const last=headings.at(-1);
      const combined=last?last.str+' '+item.str:'';
      if(last&&item.x<=last.right+8&&phrases.has(columnLabel(combined))){
        last.str=combined;last.right=item.right;
      }else headings.push({...item});
    }
    return headings;
  }
  function pdfTable(name,lines){
    const rows=lines.map(line=>line.items.map(item=>item.str));
    for(const [index,line] of lines.entries()){
      const headings=pdfHeadings(line.items);
      const labels=headings.map(item=>item.str);
      const matches=key=>labels.filter(label=>aliases[key].includes(columnLabel(label))).length;
      if(matches('name')!==1||matches('value')!==1||headings.some((item,i)=>i>0&&item.x-headings[i-1].x<=4))continue;
      rows[index]=labels;
      let end=rows.length,current=-1;
      const fragments={},nameColumn=columnIndex(labels,'name'),valueColumn=columnIndex(labels,'value');
      for(let i=index+1;i<rows.length;i++){
        const text=rows[i].join(' ').trim();
        if(pdfFooter.test(text)){end=i;break;}
        const row=Array(headings.length).fill('');
        for(const item of lines[i].items){
          const column=Math.max(0,headings.findLastIndex(heading=>item.x>=heading.x-2));
          row[column]=row[column]?row[column]+' '+item.str:item.str;
        }
        rows[i]=row;
        if(labels.every((heading,column)=>columnLabel(heading)===columnLabel(row[column]))){current=-1;continue;}
        if(row[nameColumn]||row[valueColumn])current=i;
        else if(current>=0&&lines[i-1].y-lines[i].y<25)(fragments[current]??=[]).push(i);
        else current=-1;
      }
      return {name,rows,pdfLayout:{header:index+1,end,fragments}};
    }
    return {name,rows};
  }
  function pdfPatientHints(tables){
    const hints=new Set(),printedPerson=/^\s*(\p{Lu}{3,}(?:-\p{Lu}{2,})?\s+\p{Lu}{3,}\s+\p{Lu}{3,})(?:\s|$)/u;
    for(const table of tables){
      const header=table.pdfLayout?.header??table.rows.findIndex(labels=>columnIndex(labels,'name')>=0&&columnIndex(labels,'value')>=0)+1;
      for(const row of table.rows.slice(0,header?Math.min(header-1,25):25)){
        const name=printedPerson.exec(row.join(' '))?.[1];
        if(name&&!name.includes('ИНВИТРО')&&!name.startsWith('ООО '))hints.add(name);
      }
    }
    return [...hints];
  }
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
  const collectionLabel=String.raw`(?:дата(?:\s+и\s+время)?\s+(?:взятия|забора)(?:\s+(?:образца|материала|биоматериала|крови))?|collection\s+date|collected)`;
  const printedDay=String.raw`(?:\d{1,2}\.\d{1,2}\.\d{4}|\d{4}-\d{2}-\d{2})`;
  const collectionPrefix=String.raw`(?:^|[^\p{L}\p{N}_])(${collectionLabel})`;
  const bareCollectionLabel=new RegExp(`${collectionPrefix}\\s*:?$`,'iu');
  const bareCollectionDay=new RegExp(String.raw`^${printedDay}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$`,'u');
  const collectionRange=new RegExp(String.raw`^(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?\s*(?:[-–—]|по\s+|to\s+)\s*${printedDay}`,'iu');
  function pdfCollectionDate(rows){
    const pattern=new RegExp(String.raw`${collectionPrefix}(?:\s*:\s*|\s+)(${printedDay})(?![\d./])`,'giu');
    const lines=rows.map(row=>row.join(' ').trim()),dates=new Map();
    let uncertain=false;
    for(const [index,line] of lines.entries()){
      const next=lines[index+1];
      const text=bareCollectionLabel.test(line)&&bareCollectionDay.test(next||'')?line+' '+next:line;
      for(const match of text.matchAll(pattern)){
        const [,label,raw]=match;
        try{
          const {date}=checkedDate(raw),year=Number(date.slice(0,4));
          if(year<1850||year>2200||collectionRange.test(text.slice(match.index+match[0].length))){uncertain=true;continue;}
          if(!dates.has(date))dates.set(date,{date,label,raw});
        }catch{uncertain=true;}
      }
    }
    if(uncertain||dates.size>1)return {uncertain:true};
    return dates.values().next().value??null;
  }
  const referenceRange=/^([+-]?\d+(?:[.,]\d+)?)\s*[-–—]\s*([+-]?\d+(?:[.,]\d+)?)(?:\s+([\s\S]+))?$/;
  const additionalRange=/\d\s*[-–—]\s*[+-]?\d/;
  const referenceExplanations=['оборудование ','при исследовании крови ','рекомендуемые пороговые значения','нижний диагностический порог','(чем ниже тем хуже)'];
  function referenceInterval(value,unit){
    let text=String(value??'').trim();
    const reported=String(unit??'').trim();
    if(reported&&text.startsWith(reported)&&/\s/.test(text.charAt(reported.length)))text=text.slice(reported.length).trim();
    const match=referenceRange.exec(text);
    if(!match)return null;
    const [,low,high,tail='']=match;
    const suffix=tail.trim().toLocaleLowerCase('ru-RU');
    if(suffix&&tail.trim()!==reported&&(!referenceExplanations.some(prefix=>suffix.startsWith(prefix))||additionalRange.test(suffix)))return null;
    const from=M.number(low),to=M.number(high);
    return from!==null&&to!==null&&from<=to?{low,high}:null;
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
  function draft(table,{hash,sheet,header,mapping,layout,order,fallbackDate,collectionDate},fields,imported){
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
    const results=[],positioned=table.pdfLayout?.header===header?table.pdfLayout:null;
    const fragments=positioned&&layout==='rows'&&mapping.name===columnIndex(headings,'name')&&mapping.value===columnIndex(headings,'value')
      ?positioned.fragments??{}:{};
    const fragmentRows=new Set(Object.values(fragments).flat());
    for(let rowIndex=header;rowIndex<(positioned?.end??table.rows.length);rowIndex++){
      if(fragmentRows.has(rowIndex))continue;
      const sourceRows=[table.rows[rowIndex],...(fragments[rowIndex]??[]).map(index=>table.rows[index])];
      const raw=sourceRows.length===1?sourceRows[0]:sourceRows[0].map((value,column)=>sourceRows.map(row=>row[column]).filter(Boolean).join('\n'));
      const rawCells=table.provenance?.[rowIndex]||null;
      const cells=Object.fromEntries(fields.map(key=>{
        const value=mapping[key]>=0?(raw[mapping[key]]||''):'';
        return [key,['unit','source','material','method'].includes(key)?value.replace(/\n/g,' '):value];
      }));
      if(positioned&&(!cells.name.trim()&&columns.every(column=>!raw[column]?.trim())||
        headings.every((heading,column)=>columnLabel(heading)===columnLabel(raw[column]||''))))continue;
      for(const column of columns){
        const value=raw[column]||'';
        if(layout==='dates_in_columns'&&!value.trim())continue;
        const row=table.rowNumbers?.[rowIndex]||rowIndex+1;
        const sourceCell=sourceIdentity(hash,sheet,row,column+1),previousKey=hash+':'+sheet+':'+(rowIndex+1);
        const item={...cells,value};
        const autoReference=!String(item.low??'').trim()&&!String(item.high??'').trim();
        if(autoReference)Object.assign(item,referenceInterval(item.referenceText,item.unit));
        const sourceDate=layout==='dates_in_columns'?headings[column]:item.date;
        const labelledDate=layout==='rows'&&!sourceDate?.trim()&&fallbackDate===undefined?collectionDate:undefined;
        item.date=dates.get(column)?.date||date(sourceDate?.trim()?sourceDate:fallbackDate??labelledDate?.date,order);
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
          item,problem,autoReference,duplicate:imported.has(sourceCell)||imported.has(previousKey),importKey:sourceCell,previousKey,
          row,column:column+1,sourceDate,collectionDate:labelledDate,raw,rawCells,
          headerCell:layout==='dates_in_columns'?table.provenance?.[header-1]?.find(cell=>cell.column===column)||null:null,
        });
      }
    }
    if(!results.length)throw Error('После заголовка нет результатов.');
    return results;
  }
  window.HumanImportTable={date,checkedDate,columnIndex,pdfTable,pdfPatientHints,pdfCollectionDate,referenceInterval,suggestedLayout,importedCoordinates,duplicateIndex,draft};
})();
